import { ConnectButton } from '@rainbow-me/rainbowkit';
import '../styles/Header.css';

type HeaderProps = {
  contractAddress: string;
};

export function Header({ contractAddress }: HeaderProps) {
  return (
    <header className="header">
      <div className="header-container">
        <div>
          <p className="eyebrow">SecureVaultDB · FHE</p>
          <h1 className="header-title">Fully encrypted database on Sepolia</h1>
          <p className="header-subtitle">
            Generate a sealed access address, encrypt data with Zama Relayer, and share controlled decryption rights.
          </p>
          <div className="badge-row">
            <span className="badge">Zama FHE</span>
            <span className="badge">ethers writes</span>
            <span className="badge">viem reads</span>
            <span className="badge muted">Contract: {contractAddress.slice(0, 6)}...{contractAddress.slice(-4)}</span>
          </div>
        </div>
        <ConnectButton />
      </div>
    </header>
  );
}
