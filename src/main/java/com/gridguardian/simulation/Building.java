package com.gridguardian.simulation;

public record Building(
        BuildingType type,
        boolean critical,
        HourlyProfile demandProfile
) {

    public Building {
        if (type == null) {
            throw new IllegalArgumentException("Building type cannot be null.");
        }

        if (demandProfile == null) {
            throw new IllegalArgumentException("Demand profile cannot be null.");
        }
    }

    public BuildingLoad loadAt(int hour) {
        return new BuildingLoad(
                type,
                critical,
                demandProfile.valueAt(hour)
        );
    }
}