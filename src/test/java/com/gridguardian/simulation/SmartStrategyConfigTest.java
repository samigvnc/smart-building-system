package com.gridguardian.simulation;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.Test;

class SmartStrategyConfigTest {

    @Test
    void shouldPreserveMoreBatteryWhenOutageLookAheadIsEnabled() {

        SimulationInputProvider inputProvider =
                new CsvSimulationInputProvider(
                        Set.of(
                                BuildingType.LABORATORY
                        )
                );

        List<HourlyInput> inputs =
                inputProvider.loadInputs();

        List<ScenarioCondition> conditions =
                List.of(
                        ScenarioCondition.gridOutage(
                                18,
                                20
                        )
                );

        StrategyComparisonService service =
                new StrategyComparisonService();

        StrategyComparisonResult withLookAhead =
                service.compare(
                        inputs,
                        conditions,
                        100.0,
                        50.0,
                        new SmartStrategyConfig(
                                25.0,
                                2.5,
                                3
                        )
                );

        StrategyComparisonResult withoutLookAhead =
                service.compare(
                        inputs,
                        conditions,
                        100.0,
                        50.0,
                        new SmartStrategyConfig(
                                25.0,
                                2.5,
                                0
                        )
                );

        double unservedWithLookAhead =
                withLookAhead.smart()
                        .hourlyResults()
                        .get(18)
                        .unservedEnergyKwh();

        double unservedWithoutLookAhead =
                withoutLookAhead.smart()
                        .hourlyResults()
                        .get(18)
                        .unservedEnergyKwh();

        assertTrue(
                unservedWithLookAhead
                        < unservedWithoutLookAhead
        );
    }
    @Test
void shouldReduceCostWhenHighPriceBatteryUsageIsEnabled() {

    SimulationInputProvider inputProvider =
            new CsvSimulationInputProvider(
                    Set.of(
                            BuildingType.LABORATORY
                    )
            );

    List<HourlyInput> inputs =
            inputProvider.loadInputs();

    StrategyComparisonService service =
            new StrategyComparisonService();

    StrategyComparisonResult priceAware =
            service.compare(
                    inputs,
                    List.of(),
                    100.0,
                    50.0,
                    new SmartStrategyConfig(
                            25.0,
                            2.5,
                            0
                    )
            );

    StrategyComparisonResult priceIgnored =
            service.compare(
                    inputs,
                    List.of(),
                    100.0,
                    50.0,
                    new SmartStrategyConfig(
                            25.0,
                            999.0,
                            0
                    )
            );

    double costWithPriceOptimization =
            priceAware.smart()
                    .summary()
                    .totalCost();

    double costWithoutPriceOptimization =
            priceIgnored.smart()
                    .summary()
                    .totalCost();

    assertTrue(
            costWithPriceOptimization
                    < costWithoutPriceOptimization
    );
}
}