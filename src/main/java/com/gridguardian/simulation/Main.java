package com.gridguardian.simulation;

import java.util.List;

public class Main {

    public static void main(String[] args) throws Exception {

        CsvHourlyProfileLoader loader =
                new CsvHourlyProfileLoader();

        Building dormitory =
                new Building(
                        BuildingType.DORMITORY,
                        false,
                        loader.loadFromResource(
                                "data/dev/dormitory.csv"
                        )
                );

        Building library =
                new Building(
                        BuildingType.LIBRARY,
                        false,
                        loader.loadFromResource(
                                "data/dev/library.csv"
                        )
                );

        Building laboratory =
                new Building(
                        BuildingType.LABORATORY,
                        true,
                        loader.loadFromResource(
                                "data/dev/laboratory.csv"
                        )
                );

        Building cafeteria =
                new Building(
                        BuildingType.CAFETERIA,
                        false,
                        loader.loadFromResource(
                                "data/dev/cafeteria.csv"
                        )
                );

        List<Building> buildings =
                List.of(
                        dormitory,
                        library,
                        laboratory,
                        cafeteria
                );

        HourlyProfile solarProfile =
                loader.loadFromResource(
                        "data/solar.csv"
                );

        HourlyProfile priceProfile =
                loader.loadFromResource(
                        "data/price.csv"
                );

        HourlyInputFactory factory =
                new HourlyInputFactory();

        List<HourlyInput> inputs =
                factory.create(
                        buildings,
                        solarProfile,
                        priceProfile
                );

        List<ScenarioCondition> conditions =
                List.of(
                        ScenarioCondition.gridOutage(
                                18,
                                20
                        )
                );

        StrategyComparisonService comparisonService =
                new StrategyComparisonService();

        StrategyComparisonResult comparison =
                comparisonService.compare(
                        inputs,
                        conditions,
                        100.0,
                        50.0
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