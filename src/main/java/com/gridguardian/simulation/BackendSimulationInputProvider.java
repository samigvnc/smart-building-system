package com.gridguardian.simulation;

import java.util.Comparator;
import java.util.List;
import java.util.Locale;

public class BackendSimulationInputProvider
        implements SimulationInputProvider {

    private final List<BackendHourlyData> backendData;

    public BackendSimulationInputProvider(
            List<BackendHourlyData> backendData
    ) {

        if (backendData == null) {
            throw new IllegalArgumentException(
                    "Backend data cannot be null."
            );
        }

        this.backendData =
                List.copyOf(backendData);
    }

    @Override
    public List<HourlyInput> loadInputs() {

        return backendData
                .stream()
                .sorted(
                        Comparator.comparingInt(
                                BackendHourlyData::hour
                        )
                )
                .map(this::toHourlyInput)
                .toList();
    }

    private HourlyInput toHourlyInput(
            BackendHourlyData data
    ) {

        List<BuildingLoad> buildingLoads =
                data.buildings()
                        .stream()
                        .map(this::toBuildingLoad)
                        .toList();

        double totalDemand =
                buildingLoads
                        .stream()
                        .mapToDouble(
                                BuildingLoad::demandKwh
                        )
                        .sum();

        return new HourlyInput(
                data.hour(),
                totalDemand,
                buildingLoads,
                data.solarGenerationKwh(),
                data.gridAvailable(),
                data.batteryAvailable(),
                data.gridPricePerKwh()
        );
    }

    private BuildingLoad toBuildingLoad(
            BackendBuildingLoad data
    ) {

        BuildingType type =
                BuildingType.valueOf(
                        data.buildingType()
                                .trim()
                                .toUpperCase(Locale.ROOT)
                );

        return new BuildingLoad(
                type,
                data.critical(),
                data.demandKwh()
        );
    }
}