package com.gridguardian.simulation;

import java.io.IOException;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import org.junit.jupiter.api.Test;

class CsvSimulationInputProviderTest {

    @Test
    void shouldLoadTwentyFourHourlyInputs() throws IOException {

        CsvHourlyProfileLoader loader =
                new CsvHourlyProfileLoader();

        List<Building> buildings =
                List.of(
                        new Building(
                                BuildingType.DORMITORY,
                                false,
                                loader.loadFromResource(
                                        "data/dev/dormitory.csv"
                                )
                        ),
                        new Building(
                                BuildingType.LIBRARY,
                                false,
                                loader.loadFromResource(
                                        "data/dev/library.csv"
                                )
                        ),
                        new Building(
                                BuildingType.LABORATORY,
                                true,
                                loader.loadFromResource(
                                        "data/dev/laboratory.csv"
                                )
                        ),
                        new Building(
                                BuildingType.CAFETERIA,
                                false,
                                loader.loadFromResource(
                                        "data/dev/cafeteria.csv"
                                )
                        )
                );

        SimulationInputProvider provider =
                new CsvSimulationInputProvider(buildings);

        List<HourlyInput> inputs =
                provider.loadInputs();

        assertEquals(24, inputs.size());

        assertEquals(0, inputs.get(0).hour());
        assertEquals(23, inputs.get(23).hour());

        assertFalse(inputs.get(0).buildingLoads().isEmpty());
    }
}