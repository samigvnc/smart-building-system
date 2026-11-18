package com.gridguardian.simulation;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import org.junit.jupiter.api.Test;

public class SmartStrategyTest {

    private static final double EPSILON = 0.0001;

    @Test
    void batteryShouldBePreservedWhenOutageIsNear() {

        Battery battery =
                new Battery(
                        100.0,
                        50.0
                );

        HourlyInput input =
                new HourlyInput(
                        16,
                        100.0,
                        20.0,
                        true,
                        true,
                        2.0
                );

        StrategyContext context =
                new StrategyContext(
                        input,
                        List.of(
                                ScenarioCondition.gridOutage(
                                        18,
                                        20
                                )
                        )
                );

        SmartStrategy strategy =
                new SmartStrategy();

        HourlyResult result =
                strategy.execute(
                        context,
                        battery
                );

        assertEquals(
                0.0,
                result.batteryToLoadKwh(),
                EPSILON
        );

        assertEquals(
                80.0,
                result.gridToLoadKwh(),
                EPSILON
        );

        assertEquals(
                50.0,
                result.batterySocEndKwh(),
                EPSILON
        );
    }

    @Test
    void highPriceShouldUseBatteryOnlyAboveReserve() {

        Battery battery =
                new Battery(
                        100.0,
                        50.0
                );

        HourlyInput input =
                new HourlyInput(
                        15,
                        40.0,
                        0.0,
                        true,
                        true,
                        3.0
                );

        SmartStrategy strategy =
                new SmartStrategy();

        HourlyResult result =
                strategy.execute(
                        input,
                        battery
                );

        assertEquals(
                25.0,
                result.batteryToLoadKwh(),
                EPSILON
        );

        assertEquals(
                15.0,
                result.gridToLoadKwh(),
                EPSILON
        );

        assertEquals(
                25.0,
                result.batterySocEndKwh(),
                EPSILON
        );
    }

    @Test
    void lowPriceShouldPreserveBattery() {

        Battery battery =
                new Battery(
                        100.0,
                        50.0
                );

        HourlyInput input =
                new HourlyInput(
                        10,
                        40.0,
                        0.0,
                        true,
                        true,
                        1.5
                );

        SmartStrategy strategy =
                new SmartStrategy();

        HourlyResult result =
                strategy.execute(
                        input,
                        battery
                );

        assertEquals(
                0.0,
                result.batteryToLoadKwh(),
                EPSILON
        );

        assertEquals(
                40.0,
                result.gridToLoadKwh(),
                EPSILON
        );

        assertEquals(
                50.0,
                result.batterySocEndKwh(),
                EPSILON
        );
    }

    @Test
    void outageShouldAllowBatteryBelowReserve() {

        Battery battery =
                new Battery(
                        100.0,
                        20.0
                );

        HourlyInput input =
                new HourlyInput(
                        19,
                        30.0,
                        0.0,
                        false,
                        true,
                        3.0
                );

        SmartStrategy strategy =
                new SmartStrategy();

        HourlyResult result =
                strategy.execute(
                        input,
                        battery
                );

        assertEquals(
                20.0,
                result.batteryToLoadKwh(),
                EPSILON
        );

        assertEquals(
                10.0,
                result.unservedEnergyKwh(),
                EPSILON
        );

        assertEquals(
                0.0,
                result.batterySocEndKwh(),
                EPSILON
        );
    }

    @Test
    void criticalBuildingShouldReceiveEnergyFirstDuringOutage() {

        List<BuildingLoad> loads =
                List.of(
                        new BuildingLoad(
                                BuildingType.DORMITORY,
                                false,
                                60.0
                        ),
                        new BuildingLoad(
                                BuildingType.LABORATORY,
                                true,
                                40.0
                        )
                );

        HourlyInput input =
                new HourlyInput(
                        19,
                        100.0,
                        loads,
                        0.0,
                        false,
                        true,
                        3.0
                );

        Battery battery =
                new Battery(
                        100.0,
                        50.0
                );

        SmartStrategy strategy =
                new SmartStrategy();

        HourlyResult result =
                strategy.execute(
                        input,
                        battery
                );

        BuildingEnergyResult dormitory =
                result.buildingResults()
                        .stream()
                        .filter(value ->
                                value.buildingType()
                                        == BuildingType.DORMITORY
                        )
                        .findFirst()
                        .orElseThrow();

        BuildingEnergyResult laboratory =
                result.buildingResults()
                        .stream()
                        .filter(value ->
                                value.buildingType()
                                        == BuildingType.LABORATORY
                        )
                        .findFirst()
                        .orElseThrow();

        assertEquals(
                40.0,
                laboratory.servedEnergyKwh(),
                EPSILON
        );

        assertEquals(
                0.0,
                laboratory.unservedEnergyKwh(),
                EPSILON
        );

        assertEquals(
                10.0,
                dormitory.servedEnergyKwh(),
                EPSILON
        );

        assertEquals(
                50.0,
                dormitory.unservedEnergyKwh(),
                EPSILON
        );
    }
}