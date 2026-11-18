package com.gridguardian.simulation;

import java.util.List;

public interface EnergyManagementStrategy {

    HourlyResult execute(
            StrategyContext context,
            Battery battery
    );

    default HourlyResult execute(
            HourlyInput input,
            Battery battery
    ) {
        return execute(
                new StrategyContext(
                        input,
                        List.of()
                ),
                battery
        );
    }
}