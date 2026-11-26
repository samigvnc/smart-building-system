package com.gridguardian.simulation;

import java.util.List;
import java.util.Set;

public record SimulationRequest(
        double batteryCapacityKwh,
        double initialBatterySocKwh,
        Set<BuildingType> criticalBuildings,
        List<ScenarioCondition> scenarioConditions,
        SmartStrategyConfig smartStrategyConfig,
        CustomStrategyConfig customStrategyConfig
) {

    public SimulationRequest {

        if (batteryCapacityKwh <= 0) {
            throw new IllegalArgumentException(
                    "Battery capacity must be greater than zero."
            );
        }

        if (initialBatterySocKwh < 0
                || initialBatterySocKwh > batteryCapacityKwh) {
            throw new IllegalArgumentException(
                    "Initial battery SoC must be between 0 and battery capacity."
            );
        }

        if (criticalBuildings == null) {
            throw new IllegalArgumentException(
                    "Critical buildings cannot be null."
            );
        }

        if (scenarioConditions == null) {
            throw new IllegalArgumentException(
                    "Scenario conditions cannot be null."
            );
        }

        if (smartStrategyConfig == null) {
            throw new IllegalArgumentException(
                    "Smart strategy config cannot be null."
            );
        }

        if (customStrategyConfig == null) {
            throw new IllegalArgumentException(
                    "Custom strategy config cannot be null."
            );
        }

        criticalBuildings =
                Set.copyOf(criticalBuildings);

        scenarioConditions =
                List.copyOf(scenarioConditions);
    }

    public SimulationRequest(
            double batteryCapacityKwh,
            double initialBatterySocKwh,
            Set<BuildingType> criticalBuildings,
            List<ScenarioCondition> scenarioConditions,
            SmartStrategyConfig smartStrategyConfig
    ) {
        this(
                batteryCapacityKwh,
                initialBatterySocKwh,
                criticalBuildings,
                scenarioConditions,
                smartStrategyConfig,
                CustomStrategyConfig.defaultConfig()
        );
    }
}