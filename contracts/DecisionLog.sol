// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract DecisionLog {
    struct Decision {
        bytes32 agentId;
        string action;
        string metadata;
        uint256 timestamp;
        address executor;
    }

    Decision[] public decisions;
    mapping(bytes32 => uint256[]) private agentDecisions;

    uint256 public constant MAX_DECISIONS = 10000;
    uint256 public pruneIndex;

    event DecisionLogged(
        bytes32 indexed agentId,
        string action,
        uint256 indexed timestamp,
        address indexed executor
    );

    event AgentRegistered(
        bytes32 indexed agentId,
        string name,
        address indexed owner
    );

    event DecisionsPruned(uint256 indexed fromIndex, uint256 indexed toIndex);

    mapping(bytes32 => bool) public registeredAgents;
    mapping(bytes32 => string) public agentNames;
    mapping(bytes32 => address) public agentOwners;

    modifier onlyRegisteredAgent(bytes32 _agentId) {
        require(registeredAgents[_agentId], "Agent not registered");
        require(agentOwners[_agentId] == msg.sender, "Not agent owner");
        _;
    }

    function registerAgent(bytes32 _agentId, string memory _name) external {
        require(!registeredAgents[_agentId], "Agent already registered");
        registeredAgents[_agentId] = true;
        agentNames[_agentId] = _name;
        agentOwners[_agentId] = msg.sender;
        emit AgentRegistered(_agentId, _name, msg.sender);
    }

    function logDecision(
        bytes32 _agentId,
        string memory _action,
        string memory _metadata
    ) external onlyRegisteredAgent(_agentId) {
        decisions.push(Decision({
            agentId: _agentId,
            action: _action,
            metadata: _metadata,
            timestamp: block.timestamp,
            executor: msg.sender
        }));
        agentDecisions[_agentId].push(decisions.length - 1);
        emit DecisionLogged(_agentId, _action, block.timestamp, msg.sender);
    }

    function pruneDecisions(uint256 _keep) external {
        require(_keep < decisions.length, "Keep count must be less than total");
        uint256 newPruneIndex = decisions.length - _keep;
        require(newPruneIndex > pruneIndex, "Already pruned to this point");
        uint256 oldPrune = pruneIndex;
        pruneIndex = newPruneIndex;
        emit DecisionsPruned(oldPrune, newPruneIndex);
    }

    function getDecisionCount() external view returns (uint256) {
        return decisions.length;
    }

    function getDecision(uint256 _index) external view returns (Decision memory) {
        require(_index < decisions.length, "Index out of bounds");
        return decisions[_index];
    }

    function getAgentDecisions(bytes32 _agentId) external view returns (Decision[] memory) {
        uint256 count = agentDecisions[_agentId].length;
        Decision[] memory result = new Decision[](count);
        for (uint256 i = 0; i < count; i++) {
            result[i] = decisions[agentDecisions[_agentId][i]];
        }
        return result;
    }

    function getAgentDecisionCount(bytes32 _agentId) external view returns (uint256) {
        return agentDecisions[_agentId].length;
    }
}
