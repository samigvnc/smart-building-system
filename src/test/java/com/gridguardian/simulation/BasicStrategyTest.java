package com.gridguardian.simulation;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

public class BasicStrategyTest {

    private static final double EPSILON = 0.0001;

    @Test
    void solarShouldCoverAllDemandWhenSufficient() {
        Battery battery = new Battery(100.0, 50.0);

        HourlyInput input = new HourlyInput(
                10,
                40.0,
                60.0,
                true,
                2.0
        );

        BasicStrategy strategy = new BasicStrategy();

        HourlyResult result = strategy.execute(input, battery);

        assertEquals(40.0, result.solarToLoadKwh(), EPSILON);
        assertEquals(20.0, result.solarToBatteryKwh(), EPSILON);
        assertEquals(0.0, result.batteryToLoadKwh(), EPSILON);
        assertEquals(0.0, result.gridToLoadKwh(), EPSILON);
        assertEquals(0.0, result.unservedEnergyKwh(), EPSILON);
        assertEquals(70.0, result.batterySocEndKwh(), EPSILON);
    }

    @Test
    void batteryShouldCoverRemainingDemandWhenSolarIsInsufficient() {
        Battery battery = new Battery(100.0, 50.0);

        HourlyInput input = new HourlyInput(
                14,
                100.0,
                60.0,
                true,
                2.0
        );

        BasicStrategy strategy = new BasicStrategy();

        HourlyResult result = strategy.execute(input, battery);

        assertEquals(60.0, result.solarToLoadKwh(), EPSILON);
        assertEquals(40.0, result.batteryToLoadKwh(), EPSILON);
        assertEquals(0.0, result.gridToLoadKwh(), EPSILON);
        assertEquals(0.0, result.unservedEnergyKwh(), EPSILON);
        assertEquals(10.0, result.batterySocEndKwh(), EPSILON);
    }

    @Test
    void gridShouldCoverRemainingDemandWhenBatteryIsInsufficient() {
        Battery battery = new Battery(100.0, 20.0);

        HourlyInput input = new HourlyInput(
                18,
                100.0,
                60.0,
                true,
                2.0
        );

        BasicStrategy strategy = new BasicStrategy();

        HourlyResult result = strategy.execute(input, battery);

        assertEquals(60.0, result.solarToLoadKwh(), EPSILON);
        assertEquals(20.0, result.batteryToLoadKwh(), EPSILON);
        assertEquals(20.0, result.gridToLoadKwh(), EPSILON);
        assertEquals(0.0, result.unservedEnergyKwh(), EPSILON);
        assertEquals(0.0, result.batterySocEndKwh(), EPSILON);
        assertEquals(40.0, result.cost(), EPSILON);
    }

    @Test
    void unservedEnergyShouldOccurWhenGridIsUnavailable() {
        Battery battery = new Battery(100.0, 20.0);

        HourlyInput input = new HourlyInput(
                18,
                100.0,
                60.0,
                false,
                2.0
        );

        BasicStrategy strategy = new BasicStrategy();

        HourlyResult result = strategy.execute(input, battery);

        assertEquals(60.0, result.solarToLoadKwh(), EPSILON);
        assertEquals(20.0, result.batteryToLoadKwh(), EPSILON);
        assertEquals(0.0, result.gridToLoadKwh(), EPSILON);
        assertEquals(20.0, result.unservedEnergyKwh(), EPSILON);
        assertEquals(0.0, result.batterySocEndKwh(), EPSILON);
        assertEquals(0.0, result.cost(), EPSILON);
    }

    @Test
    void excessSolarShouldBeCurtailedWhenBatteryIsFull() {
        Battery battery = new Battery(100.0, 100.0);

        HourlyInput input = new HourlyInput(
                12,
                40.0,
                100.0,
                true,
                2.0
        );

        BasicStrategy strategy = new BasicStrategy();

        HourlyResult result = strategy.execute(input, battery);

        assertEquals(40.0, result.solarToLoadKwh(), EPSILON);
        assertEquals(0.0, result.solarToBatteryKwh(), EPSILON);
        assertEquals(60.0, result.curtailedSolarKwh(), EPSILON);
        assertEquals(100.0, result.batterySocEndKwh(), EPSILON);
    }
}