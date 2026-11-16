package com.gridguardian.simulation;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import org.junit.jupiter.api.Test;

class SimulationServiceTest {

    @Test
    void shouldRunSimulationAndReturnBasicAndSmartResults() {

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

        SimulationService service =
                new SimulationService();

        StrategyComparisonResult result =
                service.run(request);

        assertNotNull(result);
        assertNotNull(result.basic());
        assertNotNull(result.smart());

        assertEquals(
                24,
                result.basic()
                        .hourlyResults()
                        .size()
        );

        assertEquals(
                24,
                result.smart()
                        .hourlyResults()
                        .size()
        );

        assertEquals(
                325.0,
                result.basic()
                        .summary()
                        .unservedEnergyKwh(),
                0.001
        );

        assertEquals(
                230.0,
                result.smart()
                        .summary()
                        .unservedEnergyKwh(),
                0.001
        );
    }
}