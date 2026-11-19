package com.gridguardian.simulation;

public record StrategyComparisonResult(
        StrategySimulationResult basic,
        StrategySimulationResult smart,
        StrategySimulationResult custom
) {

    public StrategyComparisonResult {
        if (basic == null
                || smart == null
                || custom == null) {
            throw new IllegalArgumentException(
                    "Comparison results cannot be null."
            );
        }
    }
}