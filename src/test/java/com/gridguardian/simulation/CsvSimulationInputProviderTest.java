package com.gridguardian.simulation;

import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import org.junit.jupiter.api.Test;

class CsvSimulationInputProviderTest {

    @Test
    void shouldLoadTwentyFourHourlyInputs() {

        SimulationInputProvider provider =
                new CsvSimulationInputProvider(
                        Set.of(
                                BuildingType.LABORATORY
                        )
                );

        List<HourlyInput> inputs =
                provider.loadInputs();

        assertEquals(24, inputs.size());

        assertEquals(0, inputs.get(0).hour());
        assertEquals(23, inputs.get(23).hour());

        assertFalse(
                inputs.get(0)
                        .buildingLoads()
                        .isEmpty()
        );
    }
}