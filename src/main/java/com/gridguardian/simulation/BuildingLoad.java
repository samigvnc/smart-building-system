package com.gridguardian.simulation;

public record BuildingLoad(
        BuildingType buildingType,
        boolean critical,
        double demandKwh
) {

    public BuildingLoad {
        if (buildingType == null) {
            throw new IllegalArgumentException("Building type cannot be null.");
        }

        if (demandKwh < 0) {
            throw new IllegalArgumentException("Building demand cannot be negative.");
        }
    }
}