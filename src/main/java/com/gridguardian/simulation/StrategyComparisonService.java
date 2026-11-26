package com.gridguardian.simulation;

import java.util.List;

public class StrategyComparisonService {

    private final SimulationEngine simulationEngine;
    private final SimulationMetricsCalculator metricsCalculator;

    public StrategyComparisonService() {
        this.simulationEngine =
                new SimulationEngine();

        this.metricsCalculator =
                new SimulationMetricsCalculator();
    }

    public StrategyComparisonResult compare(
            List<HourlyInput> inputs,
            List<ScenarioCondition> conditions,
            double batteryCapacityKwh,
            double initialBatterySocKwh
    ) {
        return compare(
                inputs,
                conditions,
                batteryCapacityKwh,
                initialBatterySocKwh,
                SmartStrategyConfig.defaultConfig(),
                CustomStrategyConfig.defaultConfig()
        );
    }

    public StrategyComparisonResult compare(
            List<HourlyInput> inputs,
            List<ScenarioCondition> conditions,
            double batteryCapacityKwh,
            double initialBatterySocKwh,
            SmartStrategyConfig smartStrategyConfig
    ) {
        return compare(
                inputs,
                conditions,
                batteryCapacityKwh,
                initialBatterySocKwh,
                smartStrategyConfig,
                CustomStrategyConfig.defaultConfig()
        );
    }

    public StrategyComparisonResult compare(
            List<HourlyInput> inputs,
            List<ScenarioCondition> conditions,
            double batteryCapacityKwh,
            double initialBatterySocKwh,
            SmartStrategyConfig smartStrategyConfig,
            CustomStrategyConfig customStrategyConfig
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

        Battery customBattery =
                new Battery(
                        batteryCapacityKwh,
                        initialBatterySocKwh
                );

        BasicStrategy basicStrategy =
                new BasicStrategy();

        SmartStrategy smartStrategy =
                new SmartStrategy(
                        smartStrategyConfig
                );

        CustomStrategy customStrategy =
                new CustomStrategy(
                        customStrategyConfig
                );

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

        List<HourlyResult> customResults =
                simulationEngine.run(
                        inputs,
                        customBattery,
                        customStrategy,
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

        SimulationSummary customSummary =
                metricsCalculator.calculate(
                        "Custom Strategy",
                        customResults
                );

        return new StrategyComparisonResult(
                new StrategySimulationResult(
                        basicSummary,
                        basicResults
                ),
                new StrategySimulationResult(
                        smartSummary,
                        smartResults
                ),
                new StrategySimulationResult(
                        customSummary,
                        customResults
                )
        );
    }
}