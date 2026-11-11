package com.gridguardian.simulation;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import org.junit.jupiter.api.Test;

public class SimulationEngineTest {

    private static final double EPSILON = 0.0001;

    @Test
    void simulationShouldProduceTwentyFourResults() {
        SimulationEngine engine = new SimulationEngine();
        Battery battery = new Battery(100.0, 50.0);
        BasicStrategy strategy = new BasicStrategy();

        List<HourlyInput> inputs = createInputs(30.0, 20.0, true, 2.0);

        List<HourlyResult> results =
                engine.run(inputs, battery, strategy);

        assertEquals(24, results.size());
    }

    @Test
    void batteryStateShouldCarryBetweenHours() {
        SimulationEngine engine = new SimulationEngine();
        Battery battery = new Battery(100.0, 50.0);
        BasicStrategy strategy = new BasicStrategy();

        List<HourlyInput> inputs = new ArrayList<>();

        for (int hour = 0; hour < 24; hour++) {
            double demand = hour == 0 ? 20.0 : 0.0;

            inputs.add(
                    new HourlyInput(
                            hour,
                            demand,
                            0.0,
                            true,
                            2.0
                    )
            );
        }

        List<HourlyResult> results =
                engine.run(inputs, battery, strategy);

        assertEquals(
                30.0,
                results.get(0).batterySocEndKwh(),
                EPSILON
        );

        assertEquals(
                30.0,
                results.get(1).batterySocEndKwh(),
                EPSILON
        );
    }

    @Test
    void everyHourShouldSatisfyEnergyBalance() {
        SimulationEngine engine = new SimulationEngine();
        Battery battery = new Battery(100.0, 50.0);
        BasicStrategy strategy = new BasicStrategy();

        List<HourlyInput> inputs =
                createInputs(100.0, 40.0, true, 2.0);

        List<HourlyResult> results =
                engine.run(inputs, battery, strategy);

        for (HourlyResult result : results) {

            double suppliedEnergy =
                    result.solarToLoadKwh()
                            + result.batteryToLoadKwh()
                            + result.gridToLoadKwh()
                            + result.unservedEnergyKwh();

            assertEquals(
                    result.demandKwh(),
                    suppliedEnergy,
                    EPSILON
            );
        }
    }

    @Test
    void simulationShouldRejectLessThanTwentyFourHours() {
        SimulationEngine engine = new SimulationEngine();
        Battery battery = new Battery(100.0, 50.0);
        BasicStrategy strategy = new BasicStrategy();

        List<HourlyInput> inputs = new ArrayList<>();

        inputs.add(
                new HourlyInput(
                        0,
                        50.0,
                        20.0,
                        true,
                        2.0
                )
        );

        assertThrows(
                IllegalArgumentException.class,
                () -> engine.run(inputs, battery, strategy)
        );
    }

    @Test
    void simulationShouldRejectIncorrectHourOrder() {
        SimulationEngine engine = new SimulationEngine();
        Battery battery = new Battery(100.0, 50.0);
        BasicStrategy strategy = new BasicStrategy();

        List<HourlyInput> inputs =
                createInputs(50.0, 20.0, true, 2.0);

        inputs.set(
                5,
                new HourlyInput(
                        6,
                        50.0,
                        20.0,
                        true,
                        2.0
                )
        );

        assertThrows(
                IllegalArgumentException.class,
                () -> engine.run(inputs, battery, strategy)
        );
    }

    private List<HourlyInput> createInputs(
            double demand,
            double solar,
            boolean gridAvailable,
            double price
    ) {

        List<HourlyInput> inputs = new ArrayList<>();

        for (int hour = 0; hour < 24; hour++) {
            inputs.add(
                    new HourlyInput(
                            hour,
                            demand,
                            solar,
                            gridAvailable,
                            price
                    )
            );
        }

        return inputs;
    }
}