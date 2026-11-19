package com.gridguardian.simulation;

import static org.junit.jupiter.api.Assertions.assertEquals;
import org.junit.jupiter.api.Test;

class CustomStrategyTest {

    private static final double EPSILON = 0.0001;

    @Test
    void shouldUseUserDefinedBatteryReserve() {

        CustomStrategyConfig config =
                new CustomStrategyConfig(
                        40.0,
                        2.5,
                        0,
                        true,
                        true
                );

        CustomStrategy strategy =
                new CustomStrategy(config);

        Battery battery =
                new Battery(
                        100.0,
                        50.0
                );

        HourlyInput input =
                new HourlyInput(
                        15,
                        30.0,
                        0.0,
                        true,
                        true,
                        3.0
                );

        HourlyResult result =
                strategy.execute(
                        input,
                        battery
                );

        assertEquals(
                10.0,
                result.batteryToLoadKwh(),
                EPSILON
        );

        assertEquals(
                20.0,
                result.gridToLoadKwh(),
                EPSILON
        );

        assertEquals(
                40.0,
                result.batterySocEndKwh(),
                EPSILON
        );
    }

    @Test
    void shouldAllowUserToDisableHighPriceBatteryUsage() {

        CustomStrategyConfig config =
                new CustomStrategyConfig(
                        25.0,
                        2.5,
                        0,
                        false,
                        true
                );

        CustomStrategy strategy =
                new CustomStrategy(config);

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
}