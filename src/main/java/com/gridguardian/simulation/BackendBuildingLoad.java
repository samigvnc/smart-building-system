package com.gridguardian.simulation;

public record BackendBuildingLoad(
        String buildingType,
        boolean critical,
        double demandKwh
) {

    public BackendBuildingLoad {

        if (buildingType == null
                || buildingType.isBlank()) {
            throw new IllegalArgumentException(
                    "Building type cannot be empty."
            );
        }

        if (demandKwh < 0) {
            throw new IllegalArgumentException(
                    "Building demand cannot be negative."
            );
        }
    }
}