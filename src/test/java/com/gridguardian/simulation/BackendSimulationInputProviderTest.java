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
    @Test
void shouldUseBatteryAsAvailableByDefault() {

    BackendHourlyData backendHour =
            new BackendHourlyData(
                    8,
                    List.of(
                            new BackendBuildingLoad(
                                    "DORMITORY",
                                    false,
                                    20.0
                            )
                    ),
                    5.0,
                    true,
                    2.0
            );

    BackendSimulationInputProvider provider =
            new BackendSimulationInputProvider(
                    List.of(backendHour)
            );

    HourlyInput input =
            provider.loadInputs().get(0);

    assertTrue(
            input.batteryAvailable()
    );
}

@Test
void shouldRejectUnsupportedBuildingType() {

    BackendHourlyData backendHour =
            new BackendHourlyData(
                    8,
                    List.of(
                            new BackendBuildingLoad(
                                    "OFFICE",
                                    false,
                                    20.0
                            )
                    ),
                    5.0,
                    true,
                    2.0
            );

    BackendSimulationInputProvider provider =
            new BackendSimulationInputProvider(
                    List.of(backendHour)
            );

    org.junit.jupiter.api.Assertions.assertThrows(
            IllegalArgumentException.class,
            provider::loadInputs
    );
}
}