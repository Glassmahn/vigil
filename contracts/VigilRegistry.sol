// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

contract VigilRegistry {
    struct AgentConfig {
        bytes32 agentId;
        string name;
        uint8 riskTier; // 0=Safe, 1=Balanced, 2=Aggressive
        bool active;
        uint256 totalValueManaged;
        uint256 totalTrades;
        int256 totalPnl;
        uint256 createdAt;
        uint256 lastActiveAt;
        address owner;
    }

    mapping(bytes32 => AgentConfig) public agents;
    bytes32[] public agentIds;

    event AgentCreated(bytes32 indexed agentId, string name, uint8 riskTier);
    event AgentUpdated(bytes32 indexed agentId, uint8 riskTier, bool active);
    event PerformanceLogged(bytes32 indexed agentId, int256 pnlDelta, uint256 valueManaged);

    modifier onlyOwner(bytes32 _agentId) {
        require(agents[_agentId].createdAt != 0, "Agent not found");
        require(agents[_agentId].owner == msg.sender, "Not agent owner");
        _;
    }

    function createAgent(bytes32 _agentId, string memory _name, uint8 _riskTier) external {
        require(agents[_agentId].createdAt == 0, "Agent exists");
        require(_riskTier <= 2, "Invalid risk tier");

        agents[_agentId] = AgentConfig({
            agentId: _agentId,
            name: _name,
            riskTier: _riskTier,
            active: true,
            totalValueManaged: 0,
            totalTrades: 0,
            totalPnl: 0,
            createdAt: block.timestamp,
            lastActiveAt: block.timestamp,
            owner: msg.sender
        });
        agentIds.push(_agentId);
        emit AgentCreated(_agentId, _name, _riskTier);
    }

    function updateRiskTier(bytes32 _agentId, uint8 _riskTier) external onlyOwner(_agentId) {
        require(_riskTier <= 2, "Invalid risk tier");
        agents[_agentId].riskTier = _riskTier;
        agents[_agentId].lastActiveAt = block.timestamp;
        emit AgentUpdated(_agentId, _riskTier, agents[_agentId].active);
    }

    function killAgent(bytes32 _agentId) external onlyOwner(_agentId) {
        require(agents[_agentId].active, "Agent already inactive");
        agents[_agentId].active = false;
        agents[_agentId].lastActiveAt = block.timestamp;
        emit AgentUpdated(_agentId, agents[_agentId].riskTier, false);
    }

    function reviveAgent(bytes32 _agentId) external onlyOwner(_agentId) {
        require(!agents[_agentId].active, "Agent already active");
        agents[_agentId].active = true;
        agents[_agentId].lastActiveAt = block.timestamp;
        emit AgentUpdated(_agentId, agents[_agentId].riskTier, true);
    }

    function logPerformance(bytes32 _agentId, int256 _pnlDelta, uint256 _valueManaged) external onlyOwner(_agentId) {
        AgentConfig storage config = agents[_agentId];
        config.totalTrades++;
        config.totalPnl += _pnlDelta;
        config.totalValueManaged = _valueManaged;
        config.lastActiveAt = block.timestamp;
        emit PerformanceLogged(_agentId, _pnlDelta, _valueManaged);
    }

    function getAgentCount() external view returns (uint256) {
        return agentIds.length;
    }

    function getAgentById(bytes32 _agentId) external view returns (AgentConfig memory) {
        return agents[_agentId];
    }
}
