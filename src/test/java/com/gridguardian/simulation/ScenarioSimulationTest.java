package com.gridguardian.simulation;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import org.junit.jupiter.api.Test;

public class ScenarioSimulationTest {

    private static final double EPSILON = 0.0001;

    @Test
    void batteryFailureShouldPreventBatteryUsage() {
        SimulationEngine engine = new SimulationEngine();
        Battery battery = new Battery(100.0, 50.0);
        BasicStrategy strategy = new BasicStrategy();

        List<HourlyInput> inputs = createInputs(
                100.0,
                20.0,
                true,
                2.0
        );

        List<ScenarioCondition> conditions = List.of(
                ScenarioCondition.batteryFailure(
                        10,
                        12
                )
        );

        List<HourlyResult> results =
                engine.run(
                        inputs,
                        battery,
                        strategy,
                        conditions
                );

        assertEquals(
                0.0,
                results.get(10).batteryToLoadKwh(),
                EPSILON
        );

        assertEquals(
                0.0,
                results.get(11).batteryToLoadKwh(),
                EPSILON
        );

        assertEquals(
                0.0,
                results.get(12).batteryToLoadKwh(),
                EPSILON
        );
    }

    @Test
    void gridOutageShouldProduceUnservedEnergyWhenLocalEnergyIsInsufficient() {
        SimulationEngine engine = new SimulationEngine();
        Battery battery = new Battery(100.0, 0.0);
        BasicStrategy strategy = new BasicStrategy();

        List<HourlyInput> inputs = createInputs(
                100.0,
                20.0,
                true,
                2.0
        );

        List<ScenarioCondition> conditions = List.of(
                ScenarioCondition.gridOutage(
                        18,
                        20
                )
        );

        List<HourlyResult> results =
                engine.run(
                        inputs,
                        battery,
                        strategy,
                        conditions
                );

        assertEquals(
                80.0,
                results.get(18).unservedEnergyKwh(),
                EPSILON
        );

        assertEquals(
                0.0,
                results.get(18).gridToLoadKwh(),
                EPSILON
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