package com.gridguardian.simulation;

import java.util.List;

public class StrategyComparisonService {

    private final SimulationEngine simulationEngine;
    private final SimulationMetricsCalculator metricsCalculator;

    public StrategyComparisonService() {
        this.simulationEngine = new SimulationEngine();
        this.metricsCalculator = new SimulationMetricsCalculator();
    }

    public StrategyComparisonResult compare(
            List<HourlyInput> inputs,
            List<ScenarioCondition> conditions,
            double batteryCapacityKwh,
            double initialBatterySocKwh
    ) {

        Battery basicBattery =
                new Battery(
                        batteryCapacityKwh,
                        initialBatterySocKwh
                );

        Battery smartBattery =
                new Battery(
                        batteryCapacityKwh,
                        initialBatterySocKwh
                );

        BasicStrategy basicStrategy =
                new BasicStrategy();

        SmartStrategy smartStrategy =
                new SmartStrategy();

        List<HourlyResult> basicResults =
                simulationEngine.run(
                        inputs,
                        basicBattery,
                        basicStrategy,
                        conditions
                );

        List<HourlyResult> smartResults =
                simulationEngine.run(
                        inputs,
                        smartBattery,
                        smartStrategy,
                        conditions
                );

        SimulationSummary basicSummary =
                metricsCalculator.calculate(
                        "Basic Strategy",
                        basicResults
                );

        SimulationSummary smartSummary =
                metricsCalculator.calculate(
                        "Smart Strategy",
                        smartResults
                );

        return new StrategyComparisonResult(
                new StrategySimulationResult(
                        basicSummary,
                        basicResults
                ),
                new StrategySimulationResult(
                        smartSummary,
                        smartResults
                )
        );
    }
}
