import { getDefaultConfig } from '@rainbow-me/rainbowkit';
import { sepolia } from 'wagmi/chains';

export const config = getDefaultConfig({
  appName: 'SecureVaultDB',
  projectId: 'b80dba4f7d084ba1a1edbfe9aafc089c',
  chains: [sepolia],
  ssr: false,
});
