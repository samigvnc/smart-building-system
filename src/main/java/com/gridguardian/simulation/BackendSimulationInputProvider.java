package com.gridguardian.simulation;

import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

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

        if (backendData.isEmpty()) {
            throw new IllegalArgumentException(
                    "Backend data cannot be empty."
            );
        }

        if (backendData.stream().anyMatch(data -> data == null)) {
            throw new IllegalArgumentException(
                    "Backend data cannot contain null values."
            );
        }

        Set<Integer> hours =
                new HashSet<>();

        for (BackendHourlyData data : backendData) {
            if (!hours.add(data.hour())) {
                throw new IllegalArgumentException(
                        "Duplicate hour: " + data.hour()
                );
            }
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

        BuildingType type;

        try {
            type =
                    BuildingType.valueOf(
                            data.buildingType()
                                    .trim()
                                    .toUpperCase(Locale.ROOT)
                    );
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException(
                    "Unsupported building type: "
                            + data.buildingType(),
                    exception
            );
        }

        return new BuildingLoad(
                type,
                data.critical(),
                data.demandKwh()
        );
    }
}