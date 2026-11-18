package com.gridguardian.simulation;

import java.util.ArrayList;
import java.util.List;

import com.gridguardian.simulation.HourlyInput;
import com.gridguardian.simulation.HourlyResult;

public class SimulationEngine {

    private final ScenarioProcessor scenarioProcessor;

    public SimulationEngine() {
        this.scenarioProcessor = new ScenarioProcessor();
    }

    public List<HourlyResult> run(
            List<HourlyInput> hourlyInputs,
            Battery battery,
            EnergyManagementStrategy strategy
    ) {
        return run(
                hourlyInputs,
                battery,
                strategy,
                List.of()
        );
    }

    public List<HourlyResult> run(
            List<HourlyInput> hourlyInputs,
            Battery battery,
            EnergyManagementStrategy strategy,
            List<ScenarioCondition> conditions
    ) {

        validateInputs(hourlyInputs);

        if (battery == null) {
            throw new IllegalArgumentException("Battery cannot be null.");
        }

        if (strategy == null) {
            throw new IllegalArgumentException("Strategy cannot be null.");
        }

        if (conditions == null) {
            throw new IllegalArgumentException("Scenario conditions cannot be null.");
        }

        List<HourlyResult> results = new ArrayList<>();

        for (HourlyInput input : hourlyInputs) {

            HourlyInput processedInput =
                    scenarioProcessor.apply(input, conditions);

            StrategyContext context =
        new StrategyContext(
                processedInput,
                conditions
        );

HourlyResult result =
        strategy.execute(
                context,
                battery
        );

            results.add(result);
        }

        return results;
    }

    private void validateInputs(List<HourlyInput> hourlyInputs) {

        if (hourlyInputs == null) {
            throw new IllegalArgumentException("Hourly inputs cannot be null.");
        }

        if (hourlyInputs.size() != 24) {
            throw new IllegalArgumentException(
                    "A simulation must contain exactly 24 hourly inputs."
            );
        }

        for (int i = 0; i < 24; i++) {

            if (hourlyInputs.get(i) == null) {
                throw new IllegalArgumentException(
                        "Hourly input cannot be null."
                );
            }

            if (hourlyInputs.get(i).hour() != i) {
                throw new IllegalArgumentException(
                        "Hourly inputs must be ordered from hour 0 to hour 23."
                );
            }
        }
    }
}