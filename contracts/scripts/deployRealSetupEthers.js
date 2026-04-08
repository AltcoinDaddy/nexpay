import { ethers } from "ethers";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readArtifact(relativePath) {
  return JSON.parse(fs.readFileSync(path.resolve(__dirname, `../${relativePath}`), "utf8"));
}

function readExistingWalletConnectProjectId(envPath) {
  if (!fs.existsSync(envPath)) {
    return process.env.VITE_WALLETCONNECT_PROJECT_ID || "";
  }

  const envContent = fs.readFileSync(envPath, "utf8");
  const match = envContent.match(/^VITE_WALLETCONNECT_PROJECT_ID="?([^"\n]+)"?$/m);
  return match?.[1] || process.env.VITE_WALLETCONNECT_PROJECT_ID || "";
}

function readExistingEnvVar(envPath, key, fallback = "") {
  if (!fs.existsSync(envPath)) {
    return process.env[key] || fallback;
  }

  const envContent = fs.readFileSync(envPath, "utf8");
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = envContent.match(new RegExp(`^${escapedKey}="?([^"\\n]+)"?$`, "m"));
  return match?.[1] || process.env[key] || fallback;
}

async function deployMockUnderlying(wallet) {
  console.log("Deploying MockUSDC test underlying...");
  const usdcArtifact = readArtifact("artifacts/contracts/MockTokens.sol/MockUSDC.json");
  const usdcFactory = new ethers.ContractFactory(usdcArtifact.abi, usdcArtifact.bytecode, wallet);
  const usdc = await usdcFactory.deploy();
  await usdc.waitForDeployment();
  const usdcAddress = await usdc.getAddress();
  console.log("✅ MockUSDC deployed to:", usdcAddress);
  return usdcAddress;
}

async function main() {
  console.log("🚀 Deploying real Nox wrapper setup to Arbitrum Sepolia...");
  console.log("========================================================\n");

  const rpc = process.env.ARB_SEPOLIA_RPC || "https://sepolia-rollup.arbitrum.io/rpc";
  const provider = new ethers.JsonRpcProvider(rpc);

  let privateKey = process.env.PRIVATE_KEY ? process.env.PRIVATE_KEY.trim() : "";
  if (!privateKey) {
    throw new Error("Missing PRIVATE_KEY in contracts/.env");
  }
  if (!privateKey.startsWith("0x")) privateKey = `0x${privateKey}`;

  const wallet = new ethers.Wallet(privateKey, provider);
  const treasuryAddress = process.env.TREASURY_ADDRESS || wallet.address;

  console.log("Deploying with account:", wallet.address);
  console.log("Treasury address:", treasuryAddress);
  console.log(
    "Account balance:",
    ethers.formatEther(await provider.getBalance(wallet.address)),
    "ETH\n"
  );

  let underlyingAddress = process.env.UNDERLYING_TOKEN_ADDRESS?.trim();
  if (!underlyingAddress) {
    underlyingAddress = await deployMockUnderlying(wallet);
  } else {
    console.log("Using existing underlying ERC-20:", underlyingAddress);
  }

  console.log("\nDeploying WrappedConfidentialToken...");
  const wrapperArtifact = readArtifact(
    "artifacts/contracts/WrappedConfidentialToken.sol/WrappedConfidentialToken.json"
  );
  const wrapperFactory = new ethers.ContractFactory(
    wrapperArtifact.abi,
    wrapperArtifact.bytecode,
    wallet
  );
  const wrapperName =
    process.env.CONFIDENTIAL_TOKEN_NAME || "Wrapped Confidential USDC";
  const wrapperSymbol =
    process.env.CONFIDENTIAL_TOKEN_SYMBOL || "wcUSDC";
  const wrapperContractUri = process.env.CONFIDENTIAL_TOKEN_URI || "";

  const confidentialToken = await wrapperFactory.deploy(
    underlyingAddress,
    wrapperName,
    wrapperSymbol,
    wrapperContractUri
  );
  await confidentialToken.waitForDeployment();
  const confidentialTokenAddress = await confidentialToken.getAddress();
  console.log("✅ WrappedConfidentialToken deployed to:", confidentialTokenAddress);

  console.log("\nDeploying NoxPay...");
  const noxArtifact = readArtifact("artifacts/contracts/NoxPay.sol/NoxPay.json");
  const noxFactory = new ethers.ContractFactory(noxArtifact.abi, noxArtifact.bytecode, wallet);
  const noxpay = await noxFactory.deploy(
    confidentialTokenAddress,
    underlyingAddress,
    treasuryAddress
  );
  await noxpay.waitForDeployment();
  const noxpayAddress = await noxpay.getAddress();
  console.log("✅ NoxPay deployed to:", noxpayAddress);

  console.log("\nUpdating frontend/.env.local...");
  const envPath = path.resolve(__dirname, "../../frontend/.env.local");
  const walletConnectProjectId = readExistingWalletConnectProjectId(envPath);
  const frontendRpcUrl = readExistingEnvVar(
    envPath,
    "VITE_ARB_SEPOLIA_RPC_URL",
    process.env.ARB_SEPOLIA_RPC || "https://sepolia-rollup.arbitrum.io/rpc"
  );
  const envLines = [
    `VITE_NOXPAY_ADDRESS="${noxpayAddress}"`,
    `VITE_CONFIDENTIAL_TOKEN_ADDRESS="${confidentialTokenAddress}"`,
    `VITE_UNDERLYING_TOKEN_ADDRESS="${underlyingAddress}"`,
    `VITE_ARB_SEPOLIA_RPC_URL="${frontendRpcUrl}"`,
  ];
  if (walletConnectProjectId) {
    envLines.push(`VITE_WALLETCONNECT_PROJECT_ID="${walletConnectProjectId}"`);
  }
  fs.writeFileSync(envPath, `${envLines.join("\n")}\n`);
  console.log("✅ frontend/.env.local updated");

  console.log("\n═══════════════════════════════════════");
  console.log("       DEPLOYMENT SUMMARY");
  console.log("═══════════════════════════════════════");
  console.log(`Underlying ERC-20:    ${underlyingAddress}`);
  console.log(`Confidential Token:   ${confidentialTokenAddress}`);
  console.log(`NoxPay Contract:      ${noxpayAddress}`);
  console.log(`Treasury Address:     ${treasuryAddress}`);
  console.log("═══════════════════════════════════════\n");

  console.log("Next required treasury action:");
  console.log(
    `- Call setOperator(${noxpayAddress}, <future timestamp>) on ${confidentialTokenAddress}`
  );
  console.log(
    "  before using treasury reward distribution or vesting, so NoxPay can move the treasury's confidential balance."
  );
}

main().catch((error) => {
  console.error("❌ Real wrapper deployment failed:", error);
  process.exit(1);
});
