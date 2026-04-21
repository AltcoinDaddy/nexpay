import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowUpRight,
  Clock3,
  ExternalLink,
  Layers3,
  Send,
  Shield,
  Users,
} from 'lucide-react';
import { decodeEventLog, formatUnits, type Hex } from 'viem';
import { useAccount, usePublicClient } from 'wagmi';
import {
  CONFIDENTIAL_TOKEN_ABI,
  CONTRACTS,
  NOXPAY_ABI,
  ZERO_ADDRESS,
} from '../config/contracts';
import { useTokenMetadata } from '../hooks/useTokenMetadata';

type ActivityMode = 'treasury' | 'recipient';

type ActivityItem = {
  id: string;
  kind: 'shield' | 'reward' | 'batch' | 'unshield';
  title: string;
  description: string;
  timestamp: number;
  txHash?: string;
};

const LOOKBACK_BLOCKS = 120_000n;

function shortenHash(value?: string) {
  if (!value) return '';
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}

function formatTimestamp(timestamp: number) {
  return new Date(timestamp * 1000).toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function getItemIcon(kind: ActivityItem['kind']) {
  switch (kind) {
    case 'shield':
      return <Shield className="w-4 h-4 text-nox-warning" />;
    case 'reward':
      return <Send className="w-4 h-4 text-nox-gold" />;
    case 'batch':
      return <Users className="w-4 h-4 text-nox-gold" />;
    case 'unshield':
      return <ArrowUpRight className="w-4 h-4 text-nox-cyan" />;
  }
}

export function ActivityTimeline({ mode }: { mode: ActivityMode }) {
  const { address } = useAccount();
  const publicClient = usePublicClient();
  const { decimals, symbol } = useTokenMetadata();
  const [items, setItems] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadActivity() {
      if (
        !address ||
        !publicClient ||
        CONTRACTS.NOXPAY === ZERO_ADDRESS ||
        CONTRACTS.CONFIDENTIAL_TOKEN === ZERO_ADDRESS
      ) {
        if (!cancelled) {
          setItems([]);
        }
        return;
      }

      setIsLoading(true);

      try {
        const latestBlock = await publicClient.getBlockNumber();
        const fromBlock = latestBlock > LOOKBACK_BLOCKS ? latestBlock - LOOKBACK_BLOCKS : 0n;

        const [noxPayLogs, confidentialLogs] = await Promise.all([
          publicClient.getLogs({
            address: CONTRACTS.NOXPAY as `0x${string}`,
            fromBlock,
            toBlock: latestBlock,
          }),
          publicClient.getLogs({
            address: CONTRACTS.CONFIDENTIAL_TOKEN as `0x${string}`,
            fromBlock,
            toBlock: latestBlock,
          }),
        ]);

        const blockNumbers = new Set<bigint>();
        for (const log of noxPayLogs) {
          if (typeof log.blockNumber === 'bigint') {
            blockNumbers.add(log.blockNumber);
          }
        }
        for (const log of confidentialLogs) {
          if (typeof log.blockNumber === 'bigint') {
            blockNumbers.add(log.blockNumber);
          }
        }

        const blockTimestampMap = new Map<bigint, number>();
        await Promise.all(
          Array.from(blockNumbers).map(async (blockNumber) => {
            const block = await publicClient.getBlock({ blockNumber });
            blockTimestampMap.set(blockNumber, Number(block.timestamp));
          })
        );

        const nextItems: ActivityItem[] = [];
        const normalizedAddress = address.toLowerCase();

        for (const log of noxPayLogs) {
          try {
            const decoded = decodeEventLog({
              abi: NOXPAY_ABI,
              data: log.data,
              topics: log.topics,
            });

            const fallbackTimestamp = typeof log.blockNumber === 'bigint'
              ? blockTimestampMap.get(log.blockNumber) ?? 0
              : 0;

            if (decoded.eventName === 'TokensShielded') {
              const args = decoded.args as {
                user: string;
                amount: bigint;
                timestamp: bigint;
              };
              if (args.user.toLowerCase() !== normalizedAddress) {
                continue;
              }
              nextItems.push({
                id: `${log.transactionHash}-shield`,
                kind: 'shield',
                title: 'Shielded tokens',
                description: `${Number(formatUnits(args.amount, decimals)).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} ${symbol} moved into the confidential balance.`,
                timestamp: Number(args.timestamp || BigInt(fallbackTimestamp)),
                txHash: log.transactionHash,
              });
            }

            if (decoded.eventName === 'RewardSent') {
              const args = decoded.args as {
                from: string;
                to: string;
                publicAggregate: bigint;
                timestamp: bigint;
              };
              const isTreasuryMatch = mode === 'treasury' && args.from.toLowerCase() === normalizedAddress;
              const isRecipientMatch = mode === 'recipient' && args.to.toLowerCase() === normalizedAddress;
              if (!isTreasuryMatch && !isRecipientMatch) {
                continue;
              }
              nextItems.push({
                id: `${log.transactionHash}-reward`,
                kind: 'reward',
                title: mode === 'treasury' ? 'Confidential reward sent' : 'Confidential reward received',
                description: `Public aggregate updated by ${Number(formatUnits(args.publicAggregate, decimals)).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} ${symbol}.`,
                timestamp: Number(args.timestamp || BigInt(fallbackTimestamp)),
                txHash: log.transactionHash,
              });
            }

            if (decoded.eventName === 'BatchPaymentExecuted' && mode === 'treasury') {
              const args = decoded.args as {
                treasury: string;
                recipientCount: bigint;
                totalPublicAmount: bigint;
                timestamp: bigint;
              };
              if (args.treasury.toLowerCase() !== normalizedAddress) {
                continue;
              }
              nextItems.push({
                id: `${log.transactionHash}-batch`,
                kind: 'batch',
                title: 'Batch payout executed',
                description: `${Number(args.recipientCount)} recipients, ${Number(
                  formatUnits(args.totalPublicAmount, decimals)
                ).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })} ${symbol} added to public totals.`,
                timestamp: Number(args.timestamp || BigInt(fallbackTimestamp)),
                txHash: log.transactionHash,
              });
            }
          } catch {
            continue;
          }
        }

        for (const log of confidentialLogs) {
          try {
            const decoded = decodeEventLog({
              abi: CONFIDENTIAL_TOKEN_ABI,
              data: log.data,
              topics: log.topics,
            });

            if (decoded.eventName !== 'UnwrapFinalized') {
              continue;
            }

            const args = decoded.args as {
              receiver: string;
              encryptedAmount: Hex;
              cleartextAmount: bigint;
            };
            if (args.receiver.toLowerCase() !== normalizedAddress) {
              continue;
            }

            const timestamp = typeof log.blockNumber === 'bigint'
              ? blockTimestampMap.get(log.blockNumber) ?? 0
              : 0;

            nextItems.push({
              id: `${log.transactionHash}-unshield`,
              kind: 'unshield',
              title: 'Unshield finalized',
              description: `${Number(formatUnits(args.cleartextAmount, decimals)).toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })} ${symbol} returned to the underlying token balance.`,
              timestamp,
              txHash: log.transactionHash,
            });
          } catch {
            continue;
          }
        }

        nextItems.sort((left, right) => right.timestamp - left.timestamp);

        if (!cancelled) {
          setItems(nextItems.slice(0, 8));
        }
      } catch {
        if (!cancelled) {
          setItems([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadActivity();

    return () => {
      cancelled = true;
    };
  }, [address, decimals, mode, publicClient, symbol]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.25 }}
    >
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-nox-gold/20 to-nox-cyan/10 flex items-center justify-center">
          <Layers3 className="w-5 h-5 text-nox-gold" />
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white">
            Recent Activity
          </h2>
          <p className="text-xs text-nox-lightgray">
            Latest on-chain actions for this {mode === 'treasury' ? 'treasury' : 'recipient'} wallet
          </p>
        </div>
      </div>

      <div className="glass-card p-6 max-w-3xl">
        {isLoading ? (
          <div className="flex items-center gap-3 text-sm text-nox-lightgray">
            <Clock3 className="w-4 h-4 animate-pulse text-nox-gold" />
            Loading recent on-chain activity...
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-nox-lightgray">
            No recent on-chain activity found for this wallet in the latest Sepolia history window.
          </p>
        ) : (
          <div className="space-y-4">
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-nox-border/40 bg-nox-dark/30 p-4"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex gap-3 min-w-0">
                    <div className="mt-0.5 w-9 h-9 rounded-xl bg-white/5 border border-nox-border/40 flex items-center justify-center shrink-0">
                      {getItemIcon(item.kind)}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">
                        {item.title}
                      </p>
                      <p className="text-sm text-nox-lightgray mt-1">
                        {item.description}
                      </p>
                      <p className="text-xs text-nox-lightgray mt-2">
                        {formatTimestamp(item.timestamp)}
                      </p>
                    </div>
                  </div>
                  {item.txHash && (
                    <a
                      href={`https://sepolia.arbiscan.io/tx/${item.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="shrink-0 inline-flex items-center gap-1 text-xs text-nox-gold hover:text-nox-deepgold transition-colors"
                    >
                      {shortenHash(item.txHash)}
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.section>
  );
}
