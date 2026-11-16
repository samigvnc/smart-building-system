package com.gridguardian.simulation;

import java.util.List;

public class SimulationService {

    private final StrategyComparisonService comparisonService;

    public SimulationService() {
        this.comparisonService =
                new StrategyComparisonService();
    }

    public StrategyComparisonResult run(
            SimulationRequest request
    ) {

        if (request == null) {
            throw new IllegalArgumentException(
                    "Simulation request cannot be null."
            );
        }

        SimulationInputProvider inputProvider =
                new CsvSimulationInputProvider(
                        request.criticalBuildings()
                );

        return run(
                request,
                inputProvider
        );
    }

    public StrategyComparisonResult run(
            SimulationRequest request,
            SimulationInputProvider inputProvider
    ) {

        if (request == null) {
            throw new IllegalArgumentException(
                    "Simulation request cannot be null."
            );
        }

        if (inputProvider == null) {
            throw new IllegalArgumentException(
                    "Simulation input provider cannot be null."
            );
        }

        List<HourlyInput> inputs =
                inputProvider.loadInputs();

        return comparisonService.compare(
                inputs,
                request.scenarioConditions(),
                request.batteryCapacityKwh(),
                request.initialBatterySocKwh(),
                request.smartStrategyConfig()
        );
    }
}