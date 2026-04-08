import { createViemHandleClient } from '@iexec-nox/handle';
import type { Hex, WalletClient } from 'viem';

type SolidityType =
  | 'bool'
  | 'address'
  | 'bytes'
  | 'string'
  | `uint${8 | 16 | 24 | 32 | 40 | 48 | 56 | 64 | 72 | 80 | 88 | 96 | 104 | 112 | 120 | 128 | 136 | 144 | 152 | 160 | 168 | 176 | 184 | 192 | 200 | 208 | 216 | 224 | 232 | 240 | 248 | 256}`
  | `int${8 | 16 | 24 | 32 | 40 | 48 | 56 | 64 | 72 | 80 | 88 | 96 | 104 | 112 | 120 | 128 | 136 | 144 | 152 | 160 | 168 | 176 | 184 | 192 | 200 | 208 | 216 | 224 | 232 | 240 | 248 | 256}`
  | `bytes${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14 | 15 | 16 | 17 | 18 | 19 | 20 | 21 | 22 | 23 | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 | 32}`;

type CompatHandleClient = {
  blockchainService: {
    getChainId: () => Promise<number>;
    getAddress: () => Promise<Hex>;
    readContract: (address: Hex, abiFragment: unknown, parameters: unknown[]) => Promise<unknown>;
    signTypedData: (data: unknown) => Promise<Hex>;
  };
  apiService: {
    get: (args: { endpoint: string; headers?: Record<string, string> }) => Promise<{
      status: number;
      data: unknown;
    }>;
  };
  storageService: {
    getItem: (key: string) => string | null;
    setItem: (key: string, value: string) => void;
    removeItem: (key: string) => void;
  };
  config: {
    smartContractAddress: Hex;
  };
};

const IS_VIEWER_ABI = {
  name: 'isViewer',
  type: 'function',
  stateMutability: 'view',
  inputs: [
    { name: 'handle', type: 'bytes32' },
    { name: 'viewer', type: 'address' },
  ],
  outputs: [{ name: '', type: 'bool' }],
} as const;

const IS_PUBLICLY_DECRYPTABLE_ABI = {
  name: 'isPubliclyDecryptable',
  type: 'function',
  stateMutability: 'view',
  inputs: [{ name: 'handle', type: 'bytes32' }],
  outputs: [{ name: '', type: 'bool' }],
} as const;

const SOLIDITY_TYPES = [
  'bool',
  'address',
  'bytes',
  'string',
  'uint8',
  'uint16',
  'uint24',
  'uint32',
  'uint40',
  'uint48',
  'uint56',
  'uint64',
  'uint72',
  'uint80',
  'uint88',
  'uint96',
  'uint104',
  'uint112',
  'uint120',
  'uint128',
  'uint136',
  'uint144',
  'uint152',
  'uint160',
  'uint168',
  'uint176',
  'uint184',
  'uint192',
  'uint200',
  'uint208',
  'uint216',
  'uint224',
  'uint232',
  'uint240',
  'uint248',
  'uint256',
  'int8',
  'int16',
  'int24',
  'int32',
  'int40',
  'int48',
  'int56',
  'int64',
  'int72',
  'int80',
  'int88',
  'int96',
  'int104',
  'int112',
  'int120',
  'int128',
  'int136',
  'int144',
  'int152',
  'int160',
  'int168',
  'int176',
  'int184',
  'int192',
  'int200',
  'int208',
  'int216',
  'int224',
  'int232',
  'int240',
  'int248',
  'int256',
  'bytes1',
  'bytes2',
  'bytes3',
  'bytes4',
  'bytes5',
  'bytes6',
  'bytes7',
  'bytes8',
  'bytes9',
  'bytes10',
  'bytes11',
  'bytes12',
  'bytes13',
  'bytes14',
  'bytes15',
  'bytes16',
  'bytes17',
  'bytes18',
  'bytes19',
  'bytes20',
  'bytes21',
  'bytes22',
  'bytes23',
  'bytes24',
  'bytes25',
  'bytes26',
  'bytes27',
  'bytes28',
  'bytes29',
  'bytes30',
  'bytes31',
  'bytes32',
] as const satisfies readonly SolidityType[];

const CODE_TO_SOLIDITY_TYPE = new Map<number, SolidityType>(
  SOLIDITY_TYPES.map((type, index) => [index, type])
);

const ZERO_PADDING_REGEXP = /^(?:00)*$/;
const F_PADDING_REGEXP = /^(?:[fF]{2})*$/;
const DERIVATION_INFO = hexToBytes(
  '0x45434945533a4145535f47434d3a7631'
);

function isHexHandle(handle: string): handle is Hex {
  return /^0x[0-9a-fA-F]{64}$/.test(handle);
}

function isHexString(value: unknown, byteSize?: number): value is Hex {
  if (typeof value !== 'string') {
    return false;
  }
  if (!/^0x([0-9a-fA-F]{2})*$/.test(value)) {
    return false;
  }
  if (byteSize !== undefined && value.length !== 2 + byteSize * 2) {
    return false;
  }
  return true;
}

function bytesToHex(bytes: Uint8Array): Hex {
  let hex = '0x';
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, '0');
  }
  return hex as Hex;
}

function hexToBytes(hex: Hex): Uint8Array {
  if (!isHexString(hex)) {
    throw new TypeError(`Invalid hex string: ${hex}`);
  }

  const value = hex.slice(2);
  const bytes = new Uint8Array(value.length / 2);

  for (let index = 0; index < bytes.length; index += 1) {
    bytes[index] = Number.parseInt(value.slice(index * 2, index * 2 + 2), 16);
  }

  return bytes;
}

function toArrayBuffer(bytes: Uint8Array) {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}

function hexToBool(hex: Hex) {
  if (hex !== '0x00' && hex !== '0x01') {
    throw new TypeError(`Invalid boolean hex string: ${hex}`);
  }

  return hex === '0x01';
}

function hexToUintX(hex: Hex, bitSize: number) {
  if (!isHexString(hex, bitSize / 8)) {
    throw new TypeError(`Invalid uint${bitSize} hex string: ${hex}`);
  }

  return BigInt(hex);
}

function hexToIntX(hex: Hex, bitSize: number) {
  if (!isHexString(hex, bitSize / 8)) {
    throw new TypeError(`Invalid int${bitSize} hex string: ${hex}`);
  }

  const value = BigInt(hex);
  const max = (1n << BigInt(bitSize - 1)) - 1n;
  return value > max ? value - (1n << BigInt(bitSize)) : value;
}

function hexToString(hex: Hex) {
  return new TextDecoder().decode(hexToBytes(hex));
}

function assertPadding(padding: string, paddingRegExp: RegExp) {
  if (paddingRegExp.exec(padding) === null) {
    throw new TypeError('Invalid padding');
  }
}

function assertValueLength(value: string, byteSize: number) {
  if (value.length !== byteSize * 2) {
    throw new TypeError('Invalid value length');
  }
}

function unpack(hex: Hex, solidityType: SolidityType): Hex {
  if (solidityType === 'string' || solidityType === 'bytes') {
    if (
      !isHexString(hex) ||
      hex.length < 2 + 32 * 2 ||
      (hex.length - 2) % (32 * 2) !== 0
    ) {
      throw new TypeError('Invalid hex string format');
    }

    const byteSize = Number.parseInt(hex.slice(0, 2 + 32 * 2), 16);
    const padding = hex.slice(2 + 32 * 2 + byteSize * 2);
    const value = hex.slice(2 + 32 * 2, 2 + 32 * 2 + byteSize * 2);
    assertPadding(padding, ZERO_PADDING_REGEXP);
    assertValueLength(value, byteSize);
    return `0x${value}` as Hex;
  }

  if (!isHexString(hex, 32)) {
    throw new TypeError('Invalid hex string format');
  }

  if (solidityType.startsWith('bytes')) {
    const byteSize = Number.parseInt(solidityType.slice(5), 10);
    const padding = hex.slice(2 + byteSize * 2);
    const value = hex.slice(2, 2 + byteSize * 2);
    assertPadding(padding, ZERO_PADDING_REGEXP);
    assertValueLength(value, byteSize);
    return `0x${value}` as Hex;
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
  assertValueLength(value, byteSize);

  if (solidityType === 'bool' && value !== '00' && value !== '01') {
    throw new TypeError('Invalid boolean value');
  }

  return `0x${value}` as Hex;
}

function decodeValue<T extends SolidityType>(plaintext: Hex, solidityType: T) {
  if (solidityType === 'bool') {
    return hexToBool(plaintext);
  }
  if (solidityType === 'string') {
    return hexToString(plaintext);
  }
  if (solidityType === 'bytes') {
    return plaintext;
  }
  if (solidityType === 'address') {
    if (!isHexString(plaintext, 20)) {
      throw new TypeError('Invalid address');
    }
    return plaintext;
  }
  if (solidityType.startsWith('uint')) {
    return hexToUintX(plaintext, Number.parseInt(solidityType.slice(4), 10));
  }
  if (solidityType.startsWith('int')) {
    return hexToIntX(plaintext, Number.parseInt(solidityType.slice(3), 10));
  }
  if (solidityType.startsWith('bytes')) {
    const byteSize = Number.parseInt(solidityType.slice(5), 10);
    if (!isHexString(plaintext, byteSize)) {
      throw new TypeError(`Invalid ${solidityType}`);
    }
    return plaintext;
  }

  throw new Error(`Unsupported solidity type ${solidityType}`);
}

function parseHandleMetadata(handle: string) {
  if (!isHexHandle(handle)) {
    return null;
  }

  const chainIdHex = handle.slice(2 + 26 * 2, 2 + 30 * 2);
  const typeCodeHex = handle.slice(2 + 30 * 2, 2 + 31 * 2);
  const attributeHex = handle.slice(2 + 31 * 2, 2 + 32 * 2);
  const typeCode = Number.parseInt(typeCodeHex, 16);

  return {
    chainId: Number.parseInt(chainIdHex, 16),
    typeCode,
    attribute: Number.parseInt(attributeHex, 16),
    solidityType: CODE_TO_SOLIDITY_TYPE.get(typeCode) ?? null,
  };
}

function computeDecryptionMaterialStorageKey({
  userAddress,
  verifyingContract,
  chainId,
}: {
  userAddress: Hex;
  verifyingContract: Hex;
  chainId: number;
}) {
  return `DecryptionMaterial:${userAddress}:${chainId}:${verifyingContract}:1`;
}

async function generateRsaKeyPair() {
  return crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([0x01, 0x00, 0x01]),
      hash: 'SHA-256',
    },
    true,
    ['decrypt']
  );
}

async function exportRsaPublicKey(publicKey: CryptoKey) {
  const publicKeyBuffer = await crypto.subtle.exportKey('spki', publicKey);
  return bytesToHex(new Uint8Array(publicKeyBuffer));
}

async function exportRsaPrivateKey(privateKey: CryptoKey) {
  const privateKeyBuffer = await crypto.subtle.exportKey('pkcs8', privateKey);
  return bytesToHex(new Uint8Array(privateKeyBuffer));
}

async function importRsaPrivateKey(pkcs8Hex: Hex) {
  return crypto.subtle.importKey(
    'pkcs8',
    toArrayBuffer(hexToBytes(pkcs8Hex)),
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256',
    },
    true,
    ['decrypt']
  );
}

async function rsaDecrypt(privateKey: CryptoKey, ciphertext: Hex) {
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    toArrayBuffer(hexToBytes(ciphertext))
  );

  return bytesToHex(new Uint8Array(decryptedBuffer));
}

async function eciesDecrypt({
  ciphertext,
  iv,
  sharedSecret,
}: {
  ciphertext: Hex;
  iv: Hex;
  sharedSecret: Hex;
}) {
  const ciphertextBytes = hexToBytes(ciphertext);
  const sharedSecretBytes = hexToBytes(sharedSecret);
  const ivBytes = hexToBytes(iv);

  if (sharedSecretBytes.length !== 32) {
    throw new TypeError('Invalid shared secret length');
  }
  if (ivBytes.length !== 12) {
    throw new TypeError('Invalid IV length');
  }

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    toArrayBuffer(sharedSecretBytes),
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

  const decryptedBytes = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(ivBytes),
      tagLength: 128,
    },
    aesKey,
    toArrayBuffer(ciphertextBytes)
  );

  return bytesToHex(new Uint8Array(decryptedBytes));
}

async function storeDecryptionMaterial({
  storageKey,
  authorization,
  rsaPrivateKey,
  storageService,
}: {
  storageKey: string;
  authorization: string;
  rsaPrivateKey: CryptoKey;
  storageService: CompatHandleClient['storageService'];
}) {
  const pkcs8 = await exportRsaPrivateKey(rsaPrivateKey);
  storageService.setItem(
    storageKey,
    JSON.stringify({
      authorization,
      pkcs8,
    })
  );
}

async function retrieveDecryptionMaterial({
  storageKey,
  storageService,
}: {
  storageKey: string;
  storageService: CompatHandleClient['storageService'];
}) {
  let data: string | null;

  try {
    data = storageService.getItem(storageKey);
  } catch {
    return undefined;
  }

  if (data === null) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(data) as {
      authorization: `EIP712 ${string}`;
      pkcs8: Hex;
    };
    const rsaPrivateKey = await importRsaPrivateKey(parsed.pkcs8);
    const authorizationPayload = JSON.parse(
      atob(parsed.authorization.split('EIP712 ')[1] ?? '')
    ) as {
      payload: {
        notBefore: number;
        expiresAt: number;
      };
    };
    const now = Math.floor(Date.now() / 1000);

    if (
      typeof authorizationPayload.payload.notBefore !== 'number' ||
      now < authorizationPayload.payload.notBefore ||
      typeof authorizationPayload.payload.expiresAt !== 'number' ||
      now > authorizationPayload.payload.expiresAt - 10
    ) {
      throw new Error('Invalid stored authorization');
    }

    return {
      authorization: parsed.authorization,
      rsaPrivateKey,
    };
  } catch {
    try {
      storageService.removeItem(storageKey);
    } catch {
      // ignore storage cleanup failures
    }
  }

  return undefined;
}

async function generateDecryptionMaterial({
  userAddress,
  chainId,
  smartContractAddress,
  blockchainService,
}: {
  userAddress: Hex;
  chainId: number;
  smartContractAddress: Hex;
  blockchainService: CompatHandleClient['blockchainService'];
}) {
  const rsaKeyPair = await generateRsaKeyPair();
  const rsaPrivateKey = rsaKeyPair.privateKey;
  const spkiHexRsaPubKey = await exportRsaPublicKey(rsaKeyPair.publicKey);
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
      encryptionPubKey: spkiHexRsaPubKey,
      notBefore: now,
      expiresAt: now + 3600,
    },
  };

  const signature = await blockchainService.signTypedData(typedData);
  const authorization = `EIP712 ${btoa(
    JSON.stringify({
      payload: typedData.message,
      signature,
    })
  )}`;

  return { authorization, rsaPrivateKey };
}

function validateSecretResponse(data: unknown, status: number) {
  if (
    status !== 200 ||
    typeof data !== 'object' ||
    data === null ||
    !isHexString((data as { ciphertext?: unknown }).ciphertext) ||
    !isHexString((data as { iv?: unknown }).iv, 12) ||
    !isHexString((data as { encryptedSharedSecret?: unknown }).encryptedSharedSecret)
  ) {
    throw new Error(
      `Unexpected response from Handle Gateway (status: ${status}, data: ${JSON.stringify(data)})`
    );
  }

  return data as {
    ciphertext: Hex;
    iv: Hex;
    encryptedSharedSecret: Hex;
  };
}

function validatePublicDecryptResponse(data: unknown, status: number) {
  if (
    status !== 200 ||
    typeof data !== 'object' ||
    data === null ||
    !isHexString((data as { decryptionProof?: unknown }).decryptionProof) ||
    (data as { decryptionProof: string }).decryptionProof.length < 2 + (65 + 32) * 2
  ) {
    throw new Error(
      `Unexpected response from Handle Gateway (status: ${status}, data: ${JSON.stringify(data)})`
    );
  }

  return data as {
    decryptionProof: Hex;
  };
}

export function getHandleChainId(handle?: string) {
  return typeof handle === 'string' ? parseHandleMetadata(handle)?.chainId ?? null : null;
}

export function getHandleSolidityType(handle?: string) {
  return typeof handle === 'string' ? parseHandleMetadata(handle)?.solidityType ?? null : null;
}

export function hasCompatibleHandleChain(handle: string | undefined, chainId: number) {
  return getHandleChainId(handle) === chainId;
}

export async function createCompatHandleClient(walletClient: WalletClient) {
  return createViemHandleClient(walletClient as never) as unknown as Promise<CompatHandleClient>;
}

export async function decryptHandleCompat({
  handleClient,
  handle,
}: {
  handleClient: CompatHandleClient;
  handle: Hex;
}) {
  const metadata = parseHandleMetadata(handle);
  if (!metadata) {
    throw new Error(`Invalid handle: ${handle}`);
  }
  if (!metadata.solidityType) {
    throw new Error(`Unknown handle type code: ${metadata.typeCode}`);
  }

  const [chainId, userAddress] = await Promise.all([
    handleClient.blockchainService.getChainId(),
    handleClient.blockchainService.getAddress(),
  ]);

  if (metadata.chainId !== chainId) {
    throw new Error(
      `Handle chainId (${metadata.chainId}) does not match connected chainId (${chainId})`
    );
  }

  const isViewer = await handleClient.blockchainService.readContract(
    handleClient.config.smartContractAddress,
    IS_VIEWER_ABI,
    [handle, userAddress]
  );

  if (!isViewer) {
    throw new Error(
      `Handle (${handle}) does not exist or user (${userAddress}) is not authorized to decrypt it`
    );
  }

  const storageKey = computeDecryptionMaterialStorageKey({
    userAddress,
    chainId,
    verifyingContract: handleClient.config.smartContractAddress,
  });

  let authorization: string;
  let rsaPrivateKey: CryptoKey;
  let isFreshDecryptionMaterial = false;

  const storedDecryptionMaterial = await retrieveDecryptionMaterial({
    storageKey,
    storageService: handleClient.storageService,
  });

  if (storedDecryptionMaterial) {
    authorization = storedDecryptionMaterial.authorization;
    rsaPrivateKey = storedDecryptionMaterial.rsaPrivateKey;
  } else {
    const generatedDecryptionMaterial = await generateDecryptionMaterial({
      userAddress,
      chainId,
      smartContractAddress: handleClient.config.smartContractAddress,
      blockchainService: handleClient.blockchainService,
    });
    authorization = generatedDecryptionMaterial.authorization;
    rsaPrivateKey = generatedDecryptionMaterial.rsaPrivateKey;
    isFreshDecryptionMaterial = true;
  }

  let { status, data } = await handleClient.apiService.get({
    endpoint: `/v0/secrets/${handle}`,
    headers: {
      Authorization: authorization,
    },
  });

  if (status === 401 && storedDecryptionMaterial) {
    try {
      handleClient.storageService.removeItem(storageKey);
    } catch {
      // ignore storage cleanup failures
    }

    const regeneratedDecryptionMaterial = await generateDecryptionMaterial({
      userAddress,
      chainId,
      smartContractAddress: handleClient.config.smartContractAddress,
      blockchainService: handleClient.blockchainService,
    });
    authorization = regeneratedDecryptionMaterial.authorization;
    rsaPrivateKey = regeneratedDecryptionMaterial.rsaPrivateKey;
    isFreshDecryptionMaterial = true;

    ({ status, data } = await handleClient.apiService.get({
      endpoint: `/v0/secrets/${handle}`,
      headers: {
        Authorization: authorization,
      },
    }));
  }

  const { ciphertext, iv, encryptedSharedSecret } = validateSecretResponse(data, status);

  if (isFreshDecryptionMaterial) {
    await storeDecryptionMaterial({
      storageKey,
      authorization,
      rsaPrivateKey,
      storageService: handleClient.storageService,
    }).catch(() => {
      // ignore storage write failures
    });
  }

  const sharedSecret = await rsaDecrypt(rsaPrivateKey, encryptedSharedSecret).catch((error) => {
    throw new Error('Failed to decrypt shared secret', { cause: error });
  });

  const plaintext = await eciesDecrypt({
    ciphertext,
    iv,
    sharedSecret,
  }).catch((error) => {
    throw new Error('Failed to decrypt ciphertext', { cause: error });
  });

  const value = decodeValue(unpack(plaintext, metadata.solidityType), metadata.solidityType);

  return {
    value,
    solidityType: metadata.solidityType,
    chainId: metadata.chainId,
    attribute: metadata.attribute,
  };
}

export async function publicDecryptHandleCompat({
  handleClient,
  handle,
}: {
  handleClient: CompatHandleClient;
  handle: Hex;
}) {
  const metadata = parseHandleMetadata(handle);
  if (!metadata) {
    throw new Error(`Invalid handle: ${handle}`);
  }
  if (!metadata.solidityType) {
    throw new Error(`Unknown handle type code: ${metadata.typeCode}`);
  }

  const chainId = await handleClient.blockchainService.getChainId();
  if (metadata.chainId !== chainId) {
    throw new Error(
      `Handle chainId (${metadata.chainId}) does not match connected chainId (${chainId})`
    );
  }

  const isPubliclyDecryptable = await handleClient.blockchainService.readContract(
    handleClient.config.smartContractAddress,
    IS_PUBLICLY_DECRYPTABLE_ABI,
    [handle]
  );

  if (!isPubliclyDecryptable) {
    throw new Error(`Handle (${handle}) does not exist or is not publicly decryptable`);
  }

  const { status, data } = await handleClient.apiService.get({
    endpoint: `/v0/public/${handle}`,
  });

  const { decryptionProof } = validatePublicDecryptResponse(data, status);
  const solidityPlaintext = `0x${decryptionProof.slice(2 + 65 * 2)}` as Hex;
  const value = decodeValue(
    unpack(solidityPlaintext, metadata.solidityType),
    metadata.solidityType
  );

  return {
    value,
    solidityType: metadata.solidityType,
    decryptionProof,
    chainId: metadata.chainId,
    attribute: metadata.attribute,
  };
}
