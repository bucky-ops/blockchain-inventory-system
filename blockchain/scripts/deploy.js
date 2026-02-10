const { ethers } = require("hardhat");
require("dotenv").config();

async function main() {
  console.log("🚀 Deploying Blockchain Inventory Management System...\n");

  const [deployer] = await ethers.getSigners();
  
  console.log("📋 Deployment Account:");
  console.log("   Address:", deployer.address);
  console.log("   Balance:", ethers.formatEther(await deployer.provider.getBalance(deployer.address)), "ETH\n");

  // Deploy UserRegistry first
  console.log("1️⃣  Deploying UserRegistry...");
  const UserRegistry = await ethers.getContractFactory("UserRegistry");
  const userRegistry = await UserRegistry.deploy(deployer.address);
  await userRegistry.waitForDeployment();
  const userRegistryAddress = await userRegistry.getAddress();
  console.log("   ✅ UserRegistry deployed to:", userRegistryAddress);

  // Deploy InventoryManager
  console.log("\n2️⃣  Deploying InventoryManager...");
  const InventoryManager = await ethers.getContractFactory("InventoryManager");
  const inventoryManager = await InventoryManager.deploy(deployer.address);
  await inventoryManager.waitForDeployment();
  const inventoryManagerAddress = await inventoryManager.getAddress();
  console.log("   ✅ InventoryManager deployed to:", inventoryManagerAddress);

  // Deploy AuditLogger with references to other contracts
  console.log("\n3️⃣  Deploying AuditLogger...");
  const AuditLogger = await ethers.getContractFactory("AuditLogger");
  const auditLogger = await AuditLogger.deploy(
    deployer.address,
    inventoryManagerAddress,
    userRegistryAddress
  );
  await auditLogger.waitForDeployment();
  const auditLoggerAddress = await auditLogger.getAddress();
  console.log("   ✅ AuditLogger deployed to:", auditLoggerAddress);

  // Grant roles and setup initial configuration
  console.log("\n🔧 Setting up initial configuration...");

  // Setup InventoryManager roles
  const ADMIN_ROLE = await inventoryManager.ADMIN_ROLE();
  const MANAGER_ROLE = await inventoryManager.MANAGER_ROLE();
  const OPERATOR_ROLE = await inventoryManager.OPERATOR_ROLE();
  const VIEWER_ROLE = await inventoryManager.VIEWER_ROLE();

  // Grant additional roles for testing (in production, these would be granted to specific addresses)
  console.log("   📝 Setting up InventoryManager roles...");
  await inventoryManager.grantRole(MANAGER_ROLE, deployer.address);
  await inventoryManager.grantRole(OPERATOR_ROLE, deployer.address);
  await inventoryManager.grantRole(VIEWER_ROLE, deployer.address);

  // Setup UserRegistry roles
  console.log("   👥 Setting up UserRegistry roles...");
  const USER_ADMIN_ROLE = await userRegistry.ADMIN_ROLE();
  const USER_MANAGER_ROLE = await userRegistry.MANAGER_ROLE();
  const USER_AUDITOR_ROLE = await userRegistry.AUDITOR_ROLE();
  const USER_VIEWER_ROLE = await userRegistry.VIEWER_ROLE();

  await userRegistry.grantRole(USER_MANAGER_ROLE, deployer.address);
  await userRegistry.grantRole(USER_AUDITOR_ROLE, deployer.address);
  await userRegistry.grantRole(USER_VIEWER_ROLE, deployer.address);

  // Setup AuditLogger roles
  console.log("   📊 Setting up AuditLogger roles...");
  const AUDIT_ADMIN_ROLE = await auditLogger.ADMIN_ROLE();
  const AUDIT_AUDITOR_ROLE = await auditLogger.AUDITOR_ROLE();

  await auditLogger.grantRole(AUDIT_AUDITOR_ROLE, deployer.address);

  // Create some initial test users (for development)
  console.log("\n👤 Creating initial test users...");
  
  // Test manager user
  const [, managerSigner] = await ethers.getSigners();
  if (managerSigner) {
    try {
      await userRegistry.registerUser(
        managerSigner.address,
        "manager@company.com",
        "Test Manager",
        USER_MANAGER_ROLE,
        "Initial setup - test manager account"
      );
      console.log("   ✅ Test manager created:", managerSigner.address);
    } catch (error) {
      console.log("   ⚠️  Manager might already exist");
    }
  }

  // Log the first audit event
  console.log("\n📋 Creating initial audit entry...");
  await auditLogger.logAuditEvent(
    await auditLogger.SYSTEM_EVENT(),
    0, // Low
    deployer.address,
    "SYSTEM_DEPLOYMENT",
    "BLOCKCHAIN_SYSTEM",
    "Blockchain inventory management system deployed successfully",
    ethers.keccak256(ethers.toUtf8Bytes("system_deployment_" + Date.now()))
  );
  console.log("   ✅ Initial audit entry created");

  // Save deployment information
  const deploymentInfo = {
    network: hre.network.name,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      UserRegistry: userRegistryAddress,
      InventoryManager: inventoryManagerAddress,
      AuditLogger: auditLoggerAddress
    },
    roles: {
      inventoryManager: {
        ADMIN: ADMIN_ROLE,
        MANAGER: MANAGER_ROLE,
        OPERATOR: OPERATOR_ROLE,
        VIEWER: VIEWER_ROLE
      },
      userRegistry: {
        ADMIN: USER_ADMIN_ROLE,
        MANAGER: USER_MANAGER_ROLE,
        AUDITOR: USER_AUDITOR_ROLE,
        VIEWER: USER_VIEWER_ROLE
      },
      auditLogger: {
        ADMIN: AUDIT_ADMIN_ROLE,
        AUDITOR: AUDIT_AUDITOR_ROLE
      }
    }
  };

  // Write deployment info to file
  const fs = require("fs");
  fs.writeFileSync(
    "./deployment-info.json",
    JSON.stringify(deploymentInfo, null, 2)
  );

  // Display deployment summary
  console.log("\n" + "=".repeat(60));
  console.log("🎉 DEPLOYMENT SUCCESSFUL!");
  console.log("=".repeat(60));
  console.log("📍 Network:", deploymentInfo.network);
  console.log("👤 Deployer:", deploymentInfo.deployer);
  console.log("⏰ Time:", deploymentInfo.timestamp);
  console.log("\n📄 Contract Addresses:");
  console.log("   🏢 UserRegistry:", userRegistryAddress);
  console.log("   📦 InventoryManager:", inventoryManagerAddress);
  console.log("   📊 AuditLogger:", auditLoggerAddress);
  console.log("\n💾 Deployment info saved to: deployment-info.json");
  console.log("=".repeat(60));

  // Verify contracts if on a live network
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    console.log("\n🔍 Verifying contracts on Etherscan...");
    
    try {
      await hre.run("verify:verify", {
        address: userRegistryAddress,
        constructorArguments: [deployer.address],
      });
      console.log("   ✅ UserRegistry verified");
    } catch (error) {
      console.log("   ⚠️  UserRegistry verification failed:", error.message);
    }

    try {
      await hre.run("verify:verify", {
        address: inventoryManagerAddress,
        constructorArguments: [deployer.address],
      });
      console.log("   ✅ InventoryManager verified");
    } catch (error) {
      console.log("   ⚠️  InventoryManager verification failed:", error.message);
    }

    try {
      await hre.run("verify:verify", {
        address: auditLoggerAddress,
        constructorArguments: [deployer.address, inventoryManagerAddress, userRegistryAddress],
      });
      console.log("   ✅ AuditLogger verified");
    } catch (error) {
      console.log("   ⚠️  AuditLogger verification failed:", error.message);
    }
  }

  console.log("\n🎯 Next Steps:");
  console.log("   1. Update your .env file with these contract addresses");
  console.log("   2. Start the backend service: npm run dev:backend");
  console.log("   3. Start the frontend: npm run dev:frontend");
  console.log("   4. Start the AI agents: npm run dev:ai-agents");
  console.log("\n🔗 Admin Interface:");
  console.log("   http://localhost:3000/admin");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });