// SPDX-License-Identifier: MIT
pragma solidity ^0.8.27;

import {FHE, eaddress, euint32, externalEaddress, externalEuint32} from "@fhevm/solidity/lib/FHE.sol";
import {ZamaEthereumConfig} from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title SecureVaultDB
/// @notice Encrypted database that stores a sealed access address and encrypted numeric records.
contract SecureVaultDB is ZamaEthereumConfig {
    struct Database {
        address owner;
        string name;
        eaddress encryptedAccessAddress;
        uint256 createdAt;
    }

    uint256 private _nextDatabaseId;
    mapping(uint256 => Database) private _databases;
    mapping(address => uint256[]) private _databasesByOwner;
    mapping(uint256 => euint32[]) private _records;
    mapping(uint256 => address[]) private _authorizedUsers;
    mapping(uint256 => mapping(address => bool)) private _isAuthorized;

    event DatabaseCreated(uint256 indexed databaseId, address indexed owner, string name);
    event RecordStored(uint256 indexed databaseId, uint256 indexed recordIndex);
    event AccessGranted(uint256 indexed databaseId, address indexed grantee);

    modifier databaseExists(uint256 databaseId) {
        require(_databases[databaseId].owner != address(0), "Database not found");
        _;
    }

    /// @notice Creates a new encrypted database with a sealed access address.
    /// @param name Human readable database label.
    /// @param encryptedAddress Encrypted access address generated off-chain.
    /// @param addressProof Proof for the encrypted access address.
    /// @return databaseId Newly created database identifier.
    function createDatabase(
        string calldata name,
        externalEaddress encryptedAddress,
        bytes calldata addressProof
    ) external returns (uint256 databaseId) {
        require(bytes(name).length > 0, "Name required");

        eaddress storedAddress = FHE.fromExternal(encryptedAddress, addressProof);

        databaseId = ++_nextDatabaseId;

        Database storage db = _databases[databaseId];
        db.owner = msg.sender;
        db.name = name;
        db.encryptedAccessAddress = storedAddress;
        db.createdAt = block.timestamp;

        _databasesByOwner[msg.sender].push(databaseId);
        _isAuthorized[databaseId][msg.sender] = true;
        _authorizedUsers[databaseId].push(msg.sender);

        FHE.allowThis(storedAddress);
        FHE.allow(storedAddress, msg.sender);

        emit DatabaseCreated(databaseId, msg.sender, name);
    }

    /// @notice Grants decryption rights to another account and syncs access for existing records.
    /// @param databaseId Target database id.
    /// @param user Account that should be able to decrypt.
    function grantAccess(uint256 databaseId, address user) external databaseExists(databaseId) {
        require(user != address(0), "Invalid user");
        require(_databases[databaseId].owner == msg.sender, "Only owner");
        if (_isAuthorized[databaseId][user]) {
            return;
        }

        _isAuthorized[databaseId][user] = true;
        _authorizedUsers[databaseId].push(user);

        eaddress encryptedAddress = _databases[databaseId].encryptedAccessAddress;
        if (FHE.isInitialized(encryptedAddress)) {
            FHE.allow(encryptedAddress, user);
        }

        euint32[] storage stored = _records[databaseId];
        for (uint256 i = 0; i < stored.length; i++) {
            FHE.allow(stored[i], user);
        }

        emit AccessGranted(databaseId, user);
    }

    /// @notice Stores an encrypted numeric record for a database.
    /// @param databaseId Target database id.
    /// @param encryptedValue Encrypted number created with the database access address.
    /// @param valueProof Proof for the encrypted number.
    function storeValue(
        uint256 databaseId,
        externalEuint32 encryptedValue,
        bytes calldata valueProof
    ) external databaseExists(databaseId) {
        require(_isAuthorized[databaseId][msg.sender], "Not authorized");

        euint32 value = FHE.fromExternal(encryptedValue, valueProof);

        _records[databaseId].push(value);

        FHE.allowThis(value);

        address owner = _databases[databaseId].owner;
        FHE.allow(value, owner);

        address[] storage shared = _authorizedUsers[databaseId];
        for (uint256 i = 0; i < shared.length; i++) {
            FHE.allow(value, shared[i]);
        }

        emit RecordStored(databaseId, _records[databaseId].length - 1);
    }

    /// @notice Returns the metadata and participants for a database.
    function getDatabase(
        uint256 databaseId
    )
        external
        view
        databaseExists(databaseId)
        returns (
            string memory name,
            address owner,
            eaddress encryptedAccessAddress,
            uint256 createdAt,
            uint256 recordCount,
            address[] memory sharedUsers
        )
    {
        Database storage db = _databases[databaseId];
        name = db.name;
        owner = db.owner;
        encryptedAccessAddress = db.encryptedAccessAddress;
        createdAt = db.createdAt;
        recordCount = _records[databaseId].length;
        sharedUsers = _authorizedUsers[databaseId];
    }

    /// @notice Returns the encrypted access address for a database.
    function getEncryptedAddress(uint256 databaseId) external view databaseExists(databaseId) returns (eaddress) {
        return _databases[databaseId].encryptedAccessAddress;
    }

    /// @notice Returns every encrypted record for a database.
    function getEncryptedRecords(uint256 databaseId) external view databaseExists(databaseId) returns (euint32[] memory records) {
        euint32[] storage stored = _records[databaseId];
        records = new euint32[](stored.length);
        for (uint256 i = 0; i < stored.length; i++) {
            records[i] = stored[i];
        }
    }

    /// @notice Returns a single encrypted record by index.
    function getEncryptedRecord(uint256 databaseId, uint256 index) external view databaseExists(databaseId) returns (euint32) {
        require(index < _records[databaseId].length, "Invalid index");
        return _records[databaseId][index];
    }

    /// @notice Checks whether an address is authorized to interact with a database.
    function isAuthorized(uint256 databaseId, address user) external view databaseExists(databaseId) returns (bool) {
        return _isAuthorized[databaseId][user];
    }

    /// @notice Returns the total number of created databases.
    function databaseCount() external view returns (uint256) {
        return _nextDatabaseId;
    }

    /// @notice Lists database ids that belong to a specific owner.
    function getDatabasesByOwner(address ownerAddress) external view returns (uint256[] memory) {
        return _databasesByOwner[ownerAddress];
    }
}
