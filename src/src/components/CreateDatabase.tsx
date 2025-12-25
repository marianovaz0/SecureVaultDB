import { useState } from 'react';
import { Contract, Wallet } from 'ethers';
import { useAccount } from 'wagmi';
import { type Address } from 'viem';
import { CONTRACT_ABI } from '../config/contracts';
import { useEthersSigner } from '../hooks/useEthersSigner';
import { useZamaInstance } from '../hooks/useZamaInstance';

type CreateDatabaseProps = {
  contractAddress: Address;
};

export function CreateDatabase({ contractAddress }: CreateDatabaseProps) {
  const { address } = useAccount();
  const { instance, isLoading: zamaLoading, error: zamaError } = useZamaInstance();
  const signerPromise = useEthersSigner();

  const [dbName, setDbName] = useState('');
  const [accessAddress, setAccessAddress] = useState<string>(() => Wallet.createRandom().address);
  const [status, setStatus] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const regenerateAccessAddress = () => {
    setAccessAddress(Wallet.createRandom().address);
    setStatus(null);
    setTxHash(null);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormError(null);
    setStatus(null);
    setTxHash(null);

    if (!dbName.trim()) {
      setFormError('Database name is required');
      return;
    }

    if (!instance) {
      setFormError('Encryption runtime is not ready yet');
      return;
    }

    if (!address) {
      setFormError('Connect a wallet on Sepolia before creating a database');
      return;
    }

    const signer = await signerPromise;
    if (!signer) {
      setFormError('Signer unavailable from WalletConnect');
      return;
    }

    try {
      setIsSubmitting(true);
      setStatus('Encrypting access address with Zama relayer...');

      const encryptedAddress = await instance
        .createEncryptedInput(contractAddress, address)
        .addAddress(accessAddress)
        .encrypt();

      setStatus('Sending transaction...');
      const contract = new Contract(contractAddress, CONTRACT_ABI, signer);
      const tx = await contract.createDatabase(dbName.trim(), encryptedAddress.handles[0], encryptedAddress.inputProof);
      setTxHash(tx.hash);
      await tx.wait();

      setStatus('Database stored on-chain with FHE access control.');
      setDbName('');
    } catch (error) {
      console.error(error);
      setFormError(error instanceof Error ? error.message : 'Failed to create database');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Step 1</p>
          <h2 className="panel-title">Create an encrypted database</h2>
          <p className="panel-description">
            A fresh EVM address acts as the database seal. It is encrypted with Zama FHE and stored alongside the name.
          </p>
        </div>
      </div>

      <form className="form-grid" onSubmit={handleSubmit}>
        <div className="form-group">
          <label className="field-label">Database name</label>
          <input
            className="text-input"
            placeholder="Operations vault"
            value={dbName}
            onChange={(e) => setDbName(e.target.value)}
          />
        </div>

        <div className="form-group">
          <label className="field-label">Access address A</label>
          <div className="input-with-button">
            <input className="text-input" value={accessAddress} readOnly />
            <button type="button" className="ghost-button" onClick={regenerateAccessAddress}>
              Shuffle
            </button>
          </div>
          <p className="hint">This address never leaves the chain unencrypted. Regenerate until you like it.</p>
        </div>

        <div className="form-actions">
          <button className="primary-button" type="submit" disabled={isSubmitting || zamaLoading}>
            {zamaLoading ? 'Preparing encryption...' : isSubmitting ? 'Sending...' : 'Encrypt and create'}
          </button>
          {status ? <p className="status-text">{status}</p> : null}
          {txHash ? (
            <p className="status-text">
              tx: <span className="mono">{txHash}</span>
            </p>
          ) : null}
          {formError ? <p className="error-text">{formError}</p> : null}
          {zamaError ? <p className="error-text">{zamaError}</p> : null}
        </div>
      </form>
    </section>
  );
}
