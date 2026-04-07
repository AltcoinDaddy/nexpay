import { useReadContract } from 'wagmi';
import { CONTRACTS, ERC20_ABI, ZERO_ADDRESS } from '../config/contracts';

const FALLBACK_DECIMALS = 6;
const FALLBACK_SYMBOL = 'USDC';

export function useTokenMetadata() {
  const tokenAddress = CONTRACTS.UNDERLYING_TOKEN as `0x${string}`;
  const enabled = tokenAddress !== ZERO_ADDRESS;

  const { data: decimalsData } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'decimals',
    query: { enabled },
  });

  const { data: symbolData } = useReadContract({
    address: tokenAddress,
    abi: ERC20_ABI,
    functionName: 'symbol',
    query: { enabled },
  });

  return {
    decimals: Number(decimalsData ?? FALLBACK_DECIMALS),
    symbol: symbolData ?? FALLBACK_SYMBOL,
    hasTokenConfig: enabled,
  };
}
