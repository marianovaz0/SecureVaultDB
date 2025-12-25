import { FhevmType } from "@fhevm/hardhat-plugin";
import { task } from "hardhat/config";
import type { TaskArguments } from "hardhat/types";

task("task:address", "Prints the SecureVaultDB address").setAction(async function (_args: TaskArguments, hre) {
  const { deployments } = hre;
  const deployment = await deployments.get("SecureVaultDB");
  console.log("SecureVaultDB address:", deployment.address);
});

task("task:create-db", "Creates a new encrypted database")
  .addParam("name", "Database name")
  .addParam("access", "Random access address to encrypt")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const deployment = await deployments.get("SecureVaultDB");
    const signer = (await ethers.getSigners())[0];
    const secureVault = await ethers.getContractAt("SecureVaultDB", deployment.address);

    const encryptedAddress = await fhevm
      .createEncryptedInput(deployment.address, signer.address)
      .addAddress(taskArguments.access)
      .encrypt();

    const tx = await secureVault
      .connect(signer)
      .createDatabase(taskArguments.name, encryptedAddress.handles[0], encryptedAddress.inputProof);
    console.log(`Creating database "${taskArguments.name}"... tx: ${tx.hash}`);
    await tx.wait();
    console.log("Database created");
  });

task("task:add-record", "Stores an encrypted value into a database")
  .addParam("id", "Database id")
  .addParam("value", "Value to encrypt and store")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const deployment = await deployments.get("SecureVaultDB");
    const signer = (await ethers.getSigners())[0];
    const secureVault = await ethers.getContractAt("SecureVaultDB", deployment.address);

    const numericValue = parseInt(taskArguments.value);
    if (!Number.isInteger(numericValue)) {
      throw new Error("--value must be an integer");
    }

    const encryptedValue = await fhevm
      .createEncryptedInput(deployment.address, signer.address)
      .add32(numericValue)
      .encrypt();

    const tx = await secureVault
      .connect(signer)
      .storeValue(taskArguments.id, encryptedValue.handles[0], encryptedValue.inputProof);

    console.log(`Storing value ${numericValue} in database ${taskArguments.id}... tx: ${tx.hash}`);
    await tx.wait();
    console.log("Value stored");
  });

task("task:decrypt-record", "Decrypts a stored record for the caller")
  .addParam("id", "Database id")
  .addOptionalParam("index", "Record index", "0")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const deployment = await deployments.get("SecureVaultDB");
    const signer = (await ethers.getSigners())[0];
    const secureVault = await ethers.getContractAt("SecureVaultDB", deployment.address);

    const encryptedValue = await secureVault.getEncryptedRecord(taskArguments.id, taskArguments.index);
    const clearValue = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedValue,
      deployment.address,
      signer,
    );

    console.log(`Decrypted record[${taskArguments.index}] from database ${taskArguments.id}:`, clearValue);
  });

task("task:decrypt-access", "Decrypts the stored access address for the caller")
  .addParam("id", "Database id")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { ethers, deployments, fhevm } = hre;

    await fhevm.initializeCLIApi();

    const deployment = await deployments.get("SecureVaultDB");
    const signer = (await ethers.getSigners())[0];
    const secureVault = await ethers.getContractAt("SecureVaultDB", deployment.address);

    const encryptedAddress = await secureVault.getEncryptedAddress(taskArguments.id);
    const clearAddress = await fhevm.userDecryptEaddress(encryptedAddress, deployment.address, signer);

    console.log(`Decrypted access address for database ${taskArguments.id}:`, clearAddress);
  });

task("task:details", "Shows database metadata and authorized users")
  .addParam("id", "Database id")
  .setAction(async function (taskArguments: TaskArguments, hre) {
    const { deployments, ethers } = hre;
    const deployment = await deployments.get("SecureVaultDB");
    const secureVault = await ethers.getContractAt("SecureVaultDB", deployment.address);

    const details = await secureVault.getDatabase(taskArguments.id);
    console.log("name:", details[0]);
    console.log("owner:", details[1]);
    console.log("createdAt:", details[3]);
    console.log("recordCount:", details[4].toString());
    console.log("authorized:", details[5]);
  });
