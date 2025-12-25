import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { expect } from "chai";
import { ethers, fhevm } from "hardhat";
import { FhevmType } from "@fhevm/hardhat-plugin";
import { SecureVaultDB, SecureVaultDB__factory } from "../types";

type Signers = {
  owner: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("SecureVaultDB")) as SecureVaultDB__factory;
  const contract = (await factory.deploy()) as SecureVaultDB;
  const address = await contract.getAddress();

  return { contract, address };
}

describe("SecureVaultDB", function () {
  let signers: Signers;
  let secureVault: SecureVaultDB;
  let secureVaultAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { owner: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ contract: secureVault, address: secureVaultAddress } = await deployFixture());
  });

  it("creates a database and keeps the encrypted access address readable for the owner", async function () {
    const randomAccessAddress = ethers.Wallet.createRandom().address;

    const encryptedAddress = await fhevm
      .createEncryptedInput(secureVaultAddress, signers.owner.address)
      .addAddress(randomAccessAddress)
      .encrypt();

    const tx = await secureVault
      .connect(signers.owner)
      .createDatabase("analytics", encryptedAddress.handles[0], encryptedAddress.inputProof);
    await tx.wait();

    const db = await secureVault.getDatabase(1);
    expect(db[0]).to.eq("analytics");
    expect(db[1]).to.eq(signers.owner.address);
    expect(db[4]).to.eq(0);

    const storedEncryptedAddress = await secureVault.getEncryptedAddress(1);
    const clearAccessAddress = await fhevm.userDecryptEaddress(storedEncryptedAddress, secureVaultAddress, signers.owner);
    expect(clearAccessAddress.toLowerCase()).to.eq(randomAccessAddress.toLowerCase());

    const ownerDatabases = await secureVault.getDatabasesByOwner(signers.owner.address);
    expect(ownerDatabases.length).to.eq(1);
    expect(ownerDatabases[0]).to.eq(1);
  });

  it("stores encrypted values and lets shared users decrypt them", async function () {
    const encryptedAddress = await fhevm
      .createEncryptedInput(secureVaultAddress, signers.owner.address)
      .addAddress(signers.alice.address)
      .encrypt();

    let tx = await secureVault
      .connect(signers.owner)
      .createDatabase("metrics", encryptedAddress.handles[0], encryptedAddress.inputProof);
    await tx.wait();

    const encryptedValue = await fhevm
      .createEncryptedInput(secureVaultAddress, signers.owner.address)
      .add32(42)
      .encrypt();

    tx = await secureVault
      .connect(signers.owner)
      .storeValue(1, encryptedValue.handles[0], encryptedValue.inputProof);
    await tx.wait();

    const encryptedRecords = await secureVault.getEncryptedRecords(1);
    expect(encryptedRecords.length).to.eq(1);

    const ownerDecrypted = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedRecords[0],
      secureVaultAddress,
      signers.owner,
    );
    expect(ownerDecrypted).to.eq(42);

    tx = await secureVault.connect(signers.owner).grantAccess(1, signers.bob.address);
    await tx.wait();

    const decryptedForBob = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      encryptedRecords[0],
      secureVaultAddress,
      signers.bob,
    );
    expect(decryptedForBob).to.eq(42);

    const encryptedValueFromBob = await fhevm
      .createEncryptedInput(secureVaultAddress, signers.bob.address)
      .add32(7)
      .encrypt();

    tx = await secureVault
      .connect(signers.bob)
      .storeValue(1, encryptedValueFromBob.handles[0], encryptedValueFromBob.inputProof);
    await tx.wait();

    const updatedRecords = await secureVault.getEncryptedRecords(1);
    expect(updatedRecords.length).to.eq(2);

    const bobDecrypted = await fhevm.userDecryptEuint(
      FhevmType.euint32,
      updatedRecords[1],
      secureVaultAddress,
      signers.bob,
    );
    expect(bobDecrypted).to.eq(7);
  });
});
