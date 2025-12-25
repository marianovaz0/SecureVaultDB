import { useState } from 'react';
import { isAddress, type Address } from 'viem';
import { Header } from './Header';
import { CreateDatabase } from './CreateDatabase';
import { DatabaseWorkspace } from './DatabaseWorkspace';
import { CONTRACT_ADDRESS } from '../config/contracts';
import '../styles/VaultApp.css';

export function VaultApp() {
  const [activeTab, setActiveTab] = useState<'create' | 'workspace'>('create');
  const [contractAddress, setContractAddress] = useState<Address>(CONTRACT_ADDRESS);
  const [addressDraft, setAddressDraft] = useState<string>(CONTRACT_ADDRESS);
  const [addressError, setAddressError] = useState<string | null>(null);

  const handleApplyAddress = () => {
    if (isAddress(addressDraft)) {
      setContractAddress(addressDraft as Address);
      setAddressError(null);
      return;
    }
    setAddressError('Enter a valid contract address');
  };

  return (
    <div className="vault-app">
      <Header contractAddress={contractAddress} />

      <section className="toolbar">
        <div className="toolbar-block">
          <p className="eyebrow">Contract</p>
          <div className="address-row">
            <input
              value={addressDraft}
              onChange={(e) => setAddressDraft(e.target.value)}
              className="text-input"
              placeholder="0x..."
            />
            <button className="ghost-button" onClick={handleApplyAddress}>
              Use address
            </button>
          </div>
          <p className="address-hint">
            Reads rely on viem; writes use ethers. Point this UI at your Sepolia deployment.
          </p>
          {addressError ? <p className="error-text">{addressError}</p> : null}
        </div>

        <div className="tab-buttons">
          <button
            className={activeTab === 'create' ? 'tab-button active' : 'tab-button'}
            onClick={() => setActiveTab('create')}
          >
            Create database
          </button>
          <button
            className={activeTab === 'workspace' ? 'tab-button active' : 'tab-button'}
            onClick={() => setActiveTab('workspace')}
          >
            Use database
          </button>
        </div>
      </section>

      {activeTab === 'create' ? (
        <CreateDatabase contractAddress={contractAddress} />
      ) : (
        <DatabaseWorkspace contractAddress={contractAddress} />
      )}
    </div>
  );
}
