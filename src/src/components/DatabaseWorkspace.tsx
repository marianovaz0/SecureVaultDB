import { useEffect, useMemo, useState } from 'react';
import { Contract } from 'ethers';
import { useAccount, useReadContract } from 'wagmi';
import { isAddress, type Address } from 'viem';
import { CONTRACT_ABI } from '../config/contracts';
import { useZamaInstance } from '../hooks/useZamaInstance';
import { useEthersSigner } from '../hooks/useEthersSigner';

type DatabaseWorkspaceProps = {
  contractAddress: Address;
};

type DecryptedPayload = {
  accessAddress?: string;
  values: number[];
};

export function DatabaseWorkspace({ contractAddress }: DatabaseWorkspaceProps) {
  const { address } = useAccount();
  const { instance, isLoading: zamaLoading } = useZamaInstance();
  const signerPromise = useEthersSigner();

  const [selectedDbId, setSelectedDbId] = useState<string>('');
  const [valueInput, setValueInput] = useState<string>('');
  const [grantee, setGrantee] = useState<string>('');
  const [writeStatus, setWriteStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [decrypted, setDecrypted] = useState<DecryptedPayload>({ values: [] });
  const [isDecrypting, setIsDecrypting] = useState(false);

  const ownedArgs = address ? ([address] as readonly [Address]) : undefined;
  const { data: ownedIds } = useReadContract({
    address: contractAddress,
    abi: CONTRACT_ABI,
    functionName: 'getDatabasesByOwner',
    args: ownedArgs,
    query: { enabled: !!address },
  });

  useEffect(() => {
    if (ownedIds && ownedIds.length > 0 && !selectedDbId) {
      setSelectedDbId(ownedIds[0].toString());
    }
  }, [ownedIds, selectedDbId]);

  const dbIdAsBigInt = selectedDbId ? BigInt(selectedDbId) : undefined;

  const { data: database } = useReadContract({
    address: contractAddress,
    abi: CONTRACT_ABI,
    functionName: 'getDatabase',
    args: dbIdAsBigInt !== undefined ? [dbIdAsBigInt] : undefined,
    query: {
      enabled: !!dbIdAsBigInt,
    },
  });

  const { data: encryptedRecords } = useReadContract({
    address: contractAddress,
    abi: CONTRACT_ABI,
    functionName: 'getEncryptedRecords',
    args: dbIdAsBigInt !== undefined ? [dbIdAsBigInt] : undefined,
    query: {
      enabled: !!dbIdAsBigInt,
    },
  });

  const { data: authStatus } = useReadContract({
    address: contractAddress,
    abi: CONTRACT_ABI,
    functionName: 'isAuthorized',
    args: dbIdAsBigInt !== undefined && address ? [dbIdAsBigInt, address] : undefined,
    query: {
      enabled: !!dbIdAsBigInt && !!address,
    },
  });

  const summary = useMemo(() => {
    if (!database) return null;
    return {
      name: database[0] as string,
      owner: database[1] as string,
      encryptedHandle: database[2] as `0x${string}`,
      createdAt: Number(database[3]),
      recordCount: Number(database[4]),
      shared: database[5] as string[],
    };
  }, [database]);

  useEffect(() => {
    setError(null);
    setWriteStatus(null);
    setDecrypted({ values: [] });
  }, [selectedDbId, summary, encryptedRecords]);

  const decryptDatabase = async () => {
    if (!summary || !address || !instance) {
      setError('Missing database details, wallet, or encryption runtime.');
      return;
    }
    const signer = await signerPromise;
    if (!signer) {
      setError('Signer unavailable from wallet.');
      return;
    }

    try {
      setIsDecrypting(true);
      const keypair = instance.generateKeypair();

      const handleContractPairs =
        encryptedRecords?.map((handle) => ({ handle, contractAddress })) || [];
      handleContractPairs.unshift({ handle: summary.encryptedHandle, contractAddress });

      const startTimeStamp = Math.floor(Date.now() / 1000).toString();
      const durationDays = '10';
      const contractAddresses = [contractAddress];

      const eip712 = instance.createEIP712(keypair.publicKey, contractAddresses, startTimeStamp, durationDays);
      const signature = await signer.signTypedData(
        eip712.domain,
        {
          UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification,
        },
        eip712.message,
      );

      const result = await instance.userDecrypt(
        handleContractPairs,
        keypair.privateKey,
        keypair.publicKey,
        signature.replace('0x', ''),
        contractAddresses,
        address,
        startTimeStamp,
        durationDays,
      );

      const accessAddress = result[String(summary.encryptedHandle)] as string | undefined;
      const values =
        encryptedRecords?.map((handle) => {
          const decryptedValue = result[String(handle)];
          if (typeof decryptedValue === 'string') {
            return Number(BigInt(decryptedValue));
          }
          if (typeof decryptedValue === 'number') {
            return decryptedValue;
          }
          return 0;
        }) || [];

      setDecrypted({ accessAddress, values });
      setError(null);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Decryption failed');
    } finally {
      setIsDecrypting(false);
    }
  };

  const storeValue = async () => {
    setError(null);
    setWriteStatus(null);

    if (dbIdAsBigInt === undefined) {
      setError('Select a database id first');
      return;
    }
    if (!summary || !address || !instance) {
      setError('Missing database, wallet, or encryption runtime.');
      return;
    }
    if (!valueInput) {
      setError('Enter a number to store');
      return;
    }
    const parsed = Number(valueInput);
    if (!Number.isInteger(parsed) || parsed < 0) {
      setError('Use a positive integer value');
      return;
    }

    const signer = await signerPromise;
    if (!signer) {
      setError('Signer unavailable from wallet.');
      return;
    }

    try {
      setWriteStatus('Encrypting value...');
      const encryptedValue = await instance
        .createEncryptedInput(contractAddress, address)
        .add32(parsed)
        .encrypt();

      setWriteStatus('Submitting transaction...');
      const contract = new Contract(contractAddress, CONTRACT_ABI, signer);
      const tx = await contract.storeValue(dbIdAsBigInt, encryptedValue.handles[0], encryptedValue.inputProof);
      await tx.wait();
      setWriteStatus('Value stored successfully.');
      setValueInput('');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to store value');
    }
  };

  const grantAccess = async () => {
    setError(null);
    setWriteStatus(null);

    if (dbIdAsBigInt === undefined) {
      setError('Select a database id first');
      return;
    }
    if (!summary) {
      setError('Select a database first');
      return;
    }
    if (!isAddress(grantee)) {
      setError('Enter a valid address to grant access');
      return;
    }

    const signer = await signerPromise;
    if (!signer) {
      setError('Signer unavailable from wallet.');
      return;
    }

    try {
      const contract = new Contract(contractAddress, CONTRACT_ABI, signer);
      setWriteStatus('Granting access...');
      const tx = await contract.grantAccess(dbIdAsBigInt, grantee);
      await tx.wait();
      setWriteStatus('Access granted and ACL synced.');
      setGrantee('');
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : 'Failed to grant access');
    }
  };

  if (!address) {
    return (
      <section className="panel">
        <p className="eyebrow">Step 2</p>
        <h2 className="panel-title">Decrypt and use your database</h2>
        <p className="panel-description">Connect your wallet on Sepolia to fetch database metadata and decrypt entries.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow">Step 2</p>
          <h2 className="panel-title">Decrypt and use your database</h2>
          <p className="panel-description">
            Decrypt the stored access address, add encrypted numbers, and optionally authorize teammates to decrypt.
          </p>
        </div>
      </div>

      <div className="panel-grid">
        <div className="form-group">
          <label className="field-label">Choose database</label>
          <div className="input-with-button">
            <input
              className="text-input"
              placeholder="Database id"
              value={selectedDbId}
              onChange={(e) => setSelectedDbId(e.target.value)}
            />
            {ownedIds && ownedIds.length > 0 ? (
              <div className="chip-row">
                {ownedIds.map((id) => (
                  <button
                    key={id.toString()}
                    className="chip"
                    type="button"
                    onClick={() => setSelectedDbId(id.toString())}
                  >
                    #{id.toString()}
                  </button>
                ))}
              </div>
            ) : (
              <p className="hint">No local databases yet. Create one first.</p>
            )}
          </div>
        </div>

        {summary ? (
          <div className="meta-grid">
            <div className="meta-card">
              <p className="eyebrow">Name</p>
              <p className="mono">{summary.name}</p>
            </div>
            <div className="meta-card">
              <p className="eyebrow">Owner</p>
              <p className="mono">{summary.owner}</p>
            </div>
            <div className="meta-card">
              <p className="eyebrow">Records</p>
              <p className="mono">{summary.recordCount}</p>
            </div>
            <div className="meta-card">
              <p className="eyebrow">Authorized</p>
              <div className="chip-row">
                {summary.shared.map((user) => (
                  <span className="chip muted" key={user}>
                    {user.slice(0, 6)}...{user.slice(-4)}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ) : (
          <p className="hint">Database details will appear after you choose a valid id.</p>
        )}

        <div className="action-row">
          <button
            className="primary-button"
            type="button"
            onClick={decryptDatabase}
            disabled={isDecrypting || !summary || zamaLoading}
          >
            {isDecrypting ? 'Decrypting...' : 'Decrypt database'}
          </button>
          {authStatus ? (
            <span className="pill success">You can decrypt</span>
          ) : (
            <span className="pill muted">Requires ACL access</span>
          )}
        </div>

        {decrypted.accessAddress ? (
          <div className="data-card">
            <div className="data-row">
              <p className="eyebrow">Access address</p>
              <p className="mono">{decrypted.accessAddress}</p>
            </div>
            <div className="data-row">
              <p className="eyebrow">Encrypted numbers</p>
              {decrypted.values.length > 0 ? (
                <div className="pill-row">
                  {decrypted.values.map((value, idx) => (
                    <span key={idx} className="pill">
                      #{idx}: {value}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="hint">No encrypted numbers yet.</p>
              )}
            </div>
          </div>
        ) : null}

        <div className="workspace-grid">
          <div className="form-card">
            <h3 className="form-title">Store a new value</h3>
            <p className="hint">Numbers are encrypted with the same contract ACL before landing on-chain.</p>
            <input
              className="text-input"
              placeholder="42"
              value={valueInput}
              onChange={(e) => setValueInput(e.target.value)}
            />
            <button className="secondary-button" type="button" onClick={storeValue} disabled={zamaLoading}>
              Encrypt &amp; store
            </button>
          </div>

          <div className="form-card">
            <h3 className="form-title">Authorize a reader</h3>
            <p className="hint">Grantees can decrypt the access address and all stored numbers.</p>
            <input
              className="text-input"
              placeholder="0x teammate..."
              value={grantee}
              onChange={(e) => setGrantee(e.target.value)}
            />
            <button className="secondary-button" type="button" onClick={grantAccess}>
              Grant access
            </button>
          </div>
        </div>

        {writeStatus ? <p className="status-text">{writeStatus}</p> : null}
        {error ? <p className="error-text">{error}</p> : null}
      </div>
    </section>
  );
}
