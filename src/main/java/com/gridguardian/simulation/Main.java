package com.gridguardian.simulation;

import java.util.List;
import java.util.Set;

public class Main {
        public static void main(String[] args) {

                SimulationRequest request =
                        new SimulationRequest(
                                100.0,
                                50.0,
                                Set.of(
                                        BuildingType.LABORATORY
                                ),
                                List.of(
                                        ScenarioCondition.gridOutage(
                                                18,
                                                20
                                        )
                                ),
                                new SmartStrategyConfig(
                                        25.0,
                                        2.5,
                                        3
                                )
                        );
            
                SimulationInputProvider inputProvider =
                        new CsvSimulationInputProvider(
                                request.criticalBuildings()
                        );
            
                List<HourlyInput> inputs =
                        inputProvider.loadInputs();
            
                StrategyComparisonService comparisonService =
                        new StrategyComparisonService();
            
                StrategyComparisonResult comparison =
                        comparisonService.compare(
                                inputs,
                                request.scenarioConditions(),
                                request.batteryCapacityKwh(),
                                request.initialBatterySocKwh(),
                                request.smartStrategyConfig()
                        );
            
                printSummary(
                        comparison.basic().summary()
                );
            
                System.out.println();
            
                printSummary(
                        comparison.smart().summary()
                );
            
                System.out.println();
            
                printHourlyComparison(
                        comparison
                );
            }

    private static void printSummary(
            SimulationSummary summary
    ) {

        System.out.println(
                "===== " + summary.strategyName() + " ====="
        );

        System.out.printf(
                "Total Cost: %.2f%n",
                summary.totalCost()
        );

        System.out.printf(
                "Grid Usage: %.2f kWh%n",
                summary.gridUsageKwh()
        );

        System.out.printf(
                "Solar Usage: %.2f kWh%n",
                summary.solarUsageKwh()
        );

        System.out.printf(
                "Battery Usage: %.2f kWh%n",
                summary.batteryUsageKwh()
        );

        System.out.printf(
                "Unserved Energy: %.2f kWh%n",
                summary.unservedEnergyKwh()
        );

        System.out.printf(
                "Renewable Utilization: %.2f%%%n",
                summary.renewableUtilizationPercent()
        );

        System.out.printf(
                "Final Battery SoC: %.2f kWh%n",
                summary.finalBatterySocKwh()
        );
    }

    private static void printHourlyComparison(
            StrategyComparisonResult comparison
    ) {

        System.out.println(
                "===== Hourly Comparison ====="
        );

        System.out.printf(
                "%-7s %-15s %-15s %-13s %-13s %-17s %-17s%n",
                "Hour",
                "Basic Batt.",
                "Smart Batt.",
                "Basic Grid",
                "Smart Grid",
                "Basic Unserved",
                "Smart Unserved"
        );

        for (int hour = 0; hour < 24; hour++) {

            HourlyResult basic =
                    comparison.basic()
                            .hourlyResults()
                            .get(hour);

            HourlyResult smart =
                    comparison.smart()
                            .hourlyResults()
                            .get(hour);

            System.out.printf(
                    "%02d:00   %-15.2f %-15.2f %-13.2f %-13.2f %-17.2f %-17.2f%n",
                    hour,
                    basic.batteryToLoadKwh(),
                    smart.batteryToLoadKwh(),
                    basic.gridToLoadKwh(),
                    smart.gridToLoadKwh(),
                    basic.unservedEnergyKwh(),
                    smart.unservedEnergyKwh()
            );
        }
    }
}