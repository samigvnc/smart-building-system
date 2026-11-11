package com.gridguardian.simulation;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.Test;

public class ScenarioProcessorTest {

    private static final double EPSILON = 0.0001;

    @Test
    void normalDayShouldNotChangeInput() {
        ScenarioProcessor processor = new ScenarioProcessor();

        HourlyInput input = new HourlyInput(
                12,
                100.0,
                80.0,
                true,
                true,
                2.0
        );

        HourlyInput result = processor.apply(
                input,
                List.of(ScenarioCondition.normalDay())
        );

        assertEquals(100.0, result.demandKwh(), EPSILON);
        assertEquals(80.0, result.solarGenerationKwh(), EPSILON);
        assertTrue(result.gridAvailable());
        assertTrue(result.batteryAvailable());
    }

    @Test
    void cloudyDayShouldReduceSolarGeneration() {
        ScenarioProcessor processor = new ScenarioProcessor();

        HourlyInput input = new HourlyInput(
                12,
                100.0,
                80.0,
                true,
                true,
                2.0
        );

        HourlyInput result = processor.apply(
                input,
                List.of(
                        ScenarioCondition.cloudyDay(
                                10,
                                15,
                                0.5
                        )
                )
        );

        assertEquals(40.0, result.solarGenerationKwh(), EPSILON);
    }

    @Test
    void gridOutageShouldDisableGrid() {
        ScenarioProcessor processor = new ScenarioProcessor();

        HourlyInput input = new HourlyInput(
                19,
                100.0,
                20.0,
                true,
                true,
                2.0
        );

        HourlyInput result = processor.apply(
                input,
                List.of(
                        ScenarioCondition.gridOutage(
                                18,
                                20
                        )
                )
        );

        assertFalse(result.gridAvailable());
    }

    @Test
    void batteryFailureShouldDisableBattery() {
        ScenarioProcessor processor = new ScenarioProcessor();

        HourlyInput input = new HourlyInput(
                15,
                100.0,
                20.0,
                true,
                true,
                2.0
        );

        HourlyInput result = processor.apply(
                input,
                List.of(
                        ScenarioCondition.batteryFailure(
                                14,
                                16
                        )
                )
        );

        assertFalse(result.batteryAvailable());
    }

    @Test
    void demandSpikeShouldIncreaseDemand() {
        ScenarioProcessor processor = new ScenarioProcessor();

        HourlyInput input = new HourlyInput(
                18,
                100.0,
                20.0,
                true,
                true,
                2.0
        );

        HourlyInput result = processor.apply(
                input,
                List.of(
                        ScenarioCondition.demandSpike(
                                17,
                                20,
                                1.5
                        )
                )
        );

        assertEquals(150.0, result.demandKwh(), EPSILON);
    }

    @Test
    void conditionShouldNotApplyOutsideSelectedHours() {
        ScenarioProcessor processor = new ScenarioProcessor();

        HourlyInput input = new HourlyInput(
                8,
                100.0,
                80.0,
                true,
                true,
                2.0
        );

        HourlyInput result = processor.apply(
                input,
                List.of(
                        ScenarioCondition.cloudyDay(
                                10,
                                15,
                                0.5
                        )
                )
        );

        assertEquals(80.0, result.solarGenerationKwh(), EPSILON);
    }

    @Test
    void multipleConditionsShouldApplyTogether() {
        ScenarioProcessor processor = new ScenarioProcessor();

        HourlyInput input = new HourlyInput(
                19,
                100.0,
                80.0,
                true,
                true,
                2.0
        );

        HourlyInput result = processor.apply(
                input,
                List.of(
                        ScenarioCondition.cloudyDay(
                                18,
                                20,
                                0.5
                        ),
                        ScenarioCondition.demandSpike(
                                18,
                                20,
                                1.5
                        ),
                        ScenarioCondition.gridOutage(
                                18,
                                20
                        )
                )
        );

        assertEquals(150.0, result.demandKwh(), EPSILON);
        assertEquals(40.0, result.solarGenerationKwh(), EPSILON);
        assertFalse(result.gridAvailable());
        assertTrue(result.batteryAvailable());
    }
}