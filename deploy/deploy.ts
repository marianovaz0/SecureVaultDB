import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployer } = await hre.getNamedAccounts();
  const { deploy } = hre.deployments;

  const secureVault = await deploy("SecureVaultDB", {
    from: deployer,
    log: true,
  });

  console.log(`SecureVaultDB contract: `, secureVault.address);
};
export default func;
func.id = "deploy_secure_vault_db"; // id required to prevent reexecution
func.tags = ["SecureVaultDB"];
