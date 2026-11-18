package com.gridguardian.simulation;

public record StrategyComparisonResult(
        StrategySimulationResult basic,
        StrategySimulationResult smart
) {

    public StrategyComparisonResult {
        if (basic == null || smart == null) {
            throw new IllegalArgumentException("Comparison results cannot be null.");
        }
    }
}
