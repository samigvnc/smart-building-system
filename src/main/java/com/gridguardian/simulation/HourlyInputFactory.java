package com.gridguardian.simulation;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class HourlyInputFactory {

    public List<HourlyInput> create(
            HourlyProfile demandProfile,
            HourlyProfile solarProfile,
            HourlyProfile priceProfile
    ) {

        if (demandProfile == null) {
            throw new IllegalArgumentException("Demand profile cannot be null.");
        }

        if (solarProfile == null) {
            throw new IllegalArgumentException("Solar profile cannot be null.");
        }

        if (priceProfile == null) {
            throw new IllegalArgumentException("Price profile cannot be null.");
        }

        List<HourlyInput> inputs = new ArrayList<>();

        for (int hour = 0; hour < 24; hour++) {
            inputs.add(
                    new HourlyInput(
                            hour,
                            demandProfile.valueAt(hour),
                            solarProfile.valueAt(hour),
                            true,
                            true,
                            priceProfile.valueAt(hour)
                    )
            );
        }

        return inputs;
    }

    public List<HourlyInput> create(
            List<Building> buildings,
            HourlyProfile solarProfile,
            HourlyProfile priceProfile
    ) {

        validateBuildings(buildings);

        if (solarProfile == null) {
            throw new IllegalArgumentException("Solar profile cannot be null.");
        }

        if (priceProfile == null) {
            throw new IllegalArgumentException("Price profile cannot be null.");
        }

        List<HourlyInput> inputs = new ArrayList<>();

        for (int hour = 0; hour < 24; hour++) {

            List<BuildingLoad> loads = new ArrayList<>();

            for (Building building : buildings) {
                loads.add(building.loadAt(hour));
            }

            double totalDemand = loads
                    .stream()
                    .mapToDouble(BuildingLoad::demandKwh)
                    .sum();

            inputs.add(
                    new HourlyInput(
                            hour,
                            totalDemand,
                            loads,
                            solarProfile.valueAt(hour),
                            true,
                            true,
                            priceProfile.valueAt(hour)
                    )
            );
        }

        return inputs;
    }

    private void validateBuildings(List<Building> buildings) {

        if (buildings == null || buildings.isEmpty()) {
            throw new IllegalArgumentException("Buildings cannot be empty.");
        }

        Set<BuildingType> types = new HashSet<>();

        for (Building building : buildings) {

            if (building == null) {
                throw new IllegalArgumentException("Building cannot be null.");
            }

            if (!types.add(building.type())) {
                throw new IllegalArgumentException(
                        "Duplicate building type: " + building.type()
                );
            }
        }
    }
}