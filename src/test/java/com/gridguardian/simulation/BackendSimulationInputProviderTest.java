package com.gridguardian.simulation;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import org.junit.jupiter.api.Test;

class BackendSimulationInputProviderTest {

    private static final double EPSILON = 0.0001;

    @Test
    void shouldConvertBackendDataToHourlyInput() {

        BackendHourlyData backendHour =
                new BackendHourlyData(
                        10,
                        List.of(
                                new BackendBuildingLoad(
                                        "LABORATORY",
                                        true,
                                        30.0
                                ),
                                new BackendBuildingLoad(
                                        "LIBRARY",
                                        false,
                                        20.0
                                )
                        ),
                        25.0,
                        true,
                        true,
                        2.5
                );

        BackendSimulationInputProvider provider =
                new BackendSimulationInputProvider(
                        List.of(backendHour)
                );

        List<HourlyInput> inputs =
                provider.loadInputs();

        assertEquals(
                1,
                inputs.size()
        );

        HourlyInput input =
                inputs.get(0);

        assertEquals(
                10,
                input.hour()
        );

        assertEquals(
                50.0,
                input.demandKwh(),
                EPSILON
        );

        assertEquals(
                25.0,
                input.solarGenerationKwh(),
                EPSILON
        );

        assertEquals(
                2.5,
                input.gridPricePerKwh(),
                EPSILON
        );

        assertTrue(
                input.gridAvailable()
        );

        assertTrue(
                input.batteryAvailable()
        );

        assertEquals(
                2,
                input.buildingLoads().size()
        );

        assertTrue(
                input.buildingLoads()
                        .get(0)
                        .critical()
        );
    }
}