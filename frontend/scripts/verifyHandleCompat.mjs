import { privateKeyToAccount } from 'viem/accounts';
import { arbitrumSepolia } from 'viem/chains';
import { createPublicClient, createWalletClient, http } from 'viem';

const [handle] = process.argv.slice(2);

if (!handle || !/^0x[0-9a-fA-F]{64}$/.test(handle)) {
  console.error('Usage: node scripts/verifyHandleCompat.mjs <bytes32-handle>');
  process.exit(1);
}

const rpcUrl = process.env.ARB_SEPOLIA_RPC;
const privateKey = process.env.PRIVATE_KEY;
const gatewayUrl = 'https://2e1800fc0dddeeadc189283ed1dce13c1ae28d48-3000.apps.ovh-tdx-dev.noxprotocol.dev';
const gatewayContract = '0xd464B198f06756a1d00be223634b85E0a731c229';

if (!rpcUrl || !privateKey) {
  console.error('Missing ARB_SEPOLIA_RPC or PRIVATE_KEY');
  process.exit(1);
}

const SOLIDITY_TYPES = [
  'bool', 'address', 'bytes', 'string',
  'uint8', 'uint16', 'uint24', 'uint32', 'uint40', 'uint48', 'uint56', 'uint64',
  'uint72', 'uint80', 'uint88', 'uint96', 'uint104', 'uint112', 'uint120', 'uint128',
  'uint136', 'uint144', 'uint152', 'uint160', 'uint168', 'uint176', 'uint184', 'uint192',
  'uint200', 'uint208', 'uint216', 'uint224', 'uint232', 'uint240', 'uint248', 'uint256',
  'int8', 'int16', 'int24', 'int32', 'int40', 'int48', 'int56', 'int64',
  'int72', 'int80', 'int88', 'int96', 'int104', 'int112', 'int120', 'int128',
  'int136', 'int144', 'int152', 'int160', 'int168', 'int176', 'int184', 'int192',
  'int200', 'int208', 'int216', 'int224', 'int232', 'int240', 'int248', 'int256',
  'bytes1', 'bytes2', 'bytes3', 'bytes4', 'bytes5', 'bytes6', 'bytes7', 'bytes8',
  'bytes9', 'bytes10', 'bytes11', 'bytes12', 'bytes13', 'bytes14', 'bytes15', 'bytes16',
  'bytes17', 'bytes18', 'bytes19', 'bytes20', 'bytes21', 'bytes22', 'bytes23', 'bytes24',
  'bytes25', 'bytes26', 'bytes27', 'bytes28', 'bytes29', 'bytes30', 'bytes31', 'bytes32',
];

const CODE_TO_SOLIDITY_TYPE = new Map(
  SOLIDITY_TYPES.map((type, index) => [index, type])
);

const IS_VIEWER_ABI = {
  name: 'isViewer',
  type: 'function',
  stateMutability: 'view',
  inputs: [
    { name: 'handle', type: 'bytes32' },
    { name: 'viewer', type: 'address' },
  ],
  outputs: [{ name: '', type: 'bool' }],
};

const ZERO_PADDING_REGEXP = /^(?:00)*$/;
const F_PADDING_REGEXP = /^(?:[fF]{2})*$/;
const DERIVATION_INFO = hexToBytes('0x45434945533a4145535f47434d3a7631');

function hexToBytes(hex) {
  const value = hex.slice(2);
  const bytes = new Uint8Array(value.length / 2);
  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }
  return bytes;
}

function bytesToHex(bytes) {
  let hex = '0x';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex;
}

function toArrayBuffer(bytes) {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

function parseHandleMetadata(value) {
  const chainIdHex = value.slice(2 + 26 * 2, 2 + 30 * 2);
  const typeCodeHex = value.slice(2 + 30 * 2, 2 + 31 * 2);
  const attributeHex = value.slice(2 + 31 * 2, 2 + 32 * 2);
  const typeCode = Number.parseInt(typeCodeHex, 16);

  return {
    chainId: Number.parseInt(chainIdHex, 16),
    typeCode,
    attribute: Number.parseInt(attributeHex, 16),
    solidityType: CODE_TO_SOLIDITY_TYPE.get(typeCode) ?? null,
  };
}

function assertPadding(padding, regexp) {
  if (regexp.exec(padding) === null) {
    throw new TypeError('Invalid padding');
  }
}

function unpack(hex, solidityType) {
  if (solidityType === 'string' || solidityType === 'bytes') {
    const byteSize = Number.parseInt(hex.slice(0, 2 + 32 * 2), 16);
    const padding = hex.slice(2 + 32 * 2 + byteSize * 2);
    const value = hex.slice(2 + 32 * 2, 2 + 32 * 2 + byteSize * 2);
    assertPadding(padding, ZERO_PADDING_REGEXP);
    return `0x${value}`;
  }

  if (solidityType.startsWith('bytes')) {
    const byteSize = Number.parseInt(solidityType.slice(5), 10);
    const padding = hex.slice(2 + byteSize * 2);
    const value = hex.slice(2, 2 + byteSize * 2);
    assertPadding(padding, ZERO_PADDING_REGEXP);
    return `0x${value}`;
  }

  let byteSize = 0;
  let paddingRegExp = ZERO_PADDING_REGEXP;

  if (solidityType === 'bool') {
    byteSize = 1;
  } else if (solidityType === 'address') {
    byteSize = 20;
  } else if (solidityType.startsWith('uint')) {
    byteSize = Number.parseInt(solidityType.slice(4), 10) / 8;
  } else if (solidityType.startsWith('int')) {
    byteSize = Number.parseInt(solidityType.slice(3), 10) / 8;
    if (hex[2] === 'f' || hex[2] === 'F') {
      paddingRegExp = F_PADDING_REGEXP;
    }
  }

  const padding = hex.slice(2, -(byteSize * 2));
  const value = hex.slice(-byteSize * 2);
  assertPadding(padding, paddingRegExp);
  return `0x${value}`;
}

function decodeValue(hex, solidityType) {
  if (solidityType === 'bool') return hex === '0x01';
  if (solidityType === 'string') return new TextDecoder().decode(hexToBytes(hex));
  if (solidityType === 'bytes' || solidityType === 'address' || solidityType.startsWith('bytes')) return hex;
  if (solidityType.startsWith('uint')) return BigInt(hex);
  if (solidityType.startsWith('int')) {
    const bitSize = Number.parseInt(solidityType.slice(3), 10);
    const value = BigInt(hex);
    const max = (1n << BigInt(bitSize - 1)) - 1n;
    return value > max ? value - (1n << BigInt(bitSize)) : value;
  }
  throw new Error(`Unsupported solidity type ${solidityType}`);
}

async function generateDecryptionMaterial(blockchainService, chainId, smartContractAddress, userAddress) {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: 'SHA-256',
    },
    true,
    ['decrypt']
  );
  const publicKeyDer = await crypto.subtle.exportKey('spki', keyPair.publicKey);
  const encryptionPubKey = bytesToHex(new Uint8Array(publicKeyDer));
  const now = Math.floor(Date.now() / 1000);
  const typedData = {
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      DataAccessAuthorization: [
        { name: 'userAddress', type: 'address' },
        { name: 'encryptionPubKey', type: 'string' },
        { name: 'notBefore', type: 'uint256' },
        { name: 'expiresAt', type: 'uint256' },
      ],
    },
    domain: {
      name: 'Handle Gateway',
      version: '1',
      chainId,
      verifyingContract: smartContractAddress,
    },
    primaryType: 'DataAccessAuthorization',
    message: {
      userAddress,
      encryptionPubKey,
      notBefore: now,
      expiresAt: now + 3600,
    },
  };
  const signature = await blockchainService.signTypedData(typedData);
  const authorization = `EIP712 ${btoa(JSON.stringify({ payload: typedData.message, signature }))}`;
  return { authorization, privateKey: keyPair.privateKey };
}

async function decryptHandleCompat(handleClient, value) {
  const metadata = parseHandleMetadata(value);
  const [chainId, userAddress] = await Promise.all([
    handleClient.blockchainService.getChainId(),
    handleClient.blockchainService.getAddress(),
  ]);

  if (metadata.chainId !== chainId) {
    throw new Error(`Handle chainId (${metadata.chainId}) does not match connected chainId (${chainId})`);
  }

  const isViewer = await handleClient.blockchainService.readContract(
    handleClient.config.smartContractAddress,
    IS_VIEWER_ABI,
    [value, userAddress]
  );
  if (!isViewer) {
    throw new Error(`Viewer ACL missing for ${userAddress}`);
  }

  const { authorization, privateKey } = await generateDecryptionMaterial(
    handleClient.blockchainService,
    chainId,
    handleClient.config.smartContractAddress,
    userAddress
  );

  const { status, data } = await handleClient.apiService.get({
    endpoint: `/v0/secrets/${value}`,
    headers: { Authorization: authorization },
  });

  if (status !== 200 || typeof data !== 'object' || data === null) {
    throw new Error(`Unexpected gateway response ${status}: ${JSON.stringify(data)}`);
  }

  const { ciphertext, iv, encryptedSharedSecret } = data;
  const sharedSecretBuffer = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    toArrayBuffer(hexToBytes(encryptedSharedSecret))
  );
  const sharedSecret = bytesToHex(new Uint8Array(sharedSecretBuffer));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(hexToBytes(sharedSecret)),
    'HKDF',
    false,
    ['deriveKey']
  );
  const aesKey = await crypto.subtle.deriveKey(
    {
      name: 'HKDF',
      hash: 'SHA-256',
      salt: new Uint8Array(32),
      info: toArrayBuffer(DERIVATION_INFO),
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );
  const plaintextBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: toArrayBuffer(hexToBytes(iv)), tagLength: 128 },
    aesKey,
    toArrayBuffer(hexToBytes(ciphertext))
  );

  const plaintext = bytesToHex(new Uint8Array(plaintextBuffer));
  const unpacked = unpack(plaintext, metadata.solidityType);
  const decoded = decodeValue(unpacked, metadata.solidityType);

  return {
    metadata,
    plaintext,
    unpacked,
    value: decoded,
  };
}

const account = privateKeyToAccount(privateKey);

const walletClient = createWalletClient({
  account,
  chain: arbitrumSepolia,
  transport: http(rpcUrl),
});
const publicClient = createPublicClient({
  chain: arbitrumSepolia,
  transport: http(rpcUrl),
});
const handleClient = {
  blockchainService: {
    getChainId: async () => walletClient.getChainId(),
    getAddress: async () => account.address,
    readContract: async (address, abiFragment, args) => publicClient.readContract({
      address,
      abi: [abiFragment],
      functionName: abiFragment.name,
      args,
    }),
    signTypedData: async (typedData) => account.signTypedData(typedData),
  },
  apiService: {
    get: async ({ endpoint, headers = {} }) => {
      const response = await fetch(`${gatewayUrl}${endpoint}`, { headers });
      return {
        status: response.status,
        data: await response.json(),
      };
    },
  },
  config: {
    smartContractAddress: gatewayContract,
  },
};
const result = await decryptHandleCompat(handleClient, handle);

console.log(JSON.stringify(result, (_key, value) => (
  typeof value === 'bigint' ? value.toString() : value
), 2));
