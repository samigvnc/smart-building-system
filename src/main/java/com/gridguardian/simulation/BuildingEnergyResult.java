package com.gridguardian.simulation;

public record BuildingEnergyResult(
        BuildingType buildingType,
        boolean critical,
        double demandKwh,
        double servedEnergyKwh,
        double unservedEnergyKwh
) {

    public BuildingEnergyResult {
        if (buildingType == null) {
            throw new IllegalArgumentException("Building type cannot be null.");
        }

        if (demandKwh < 0 || servedEnergyKwh < 0 || unservedEnergyKwh < 0) {
            throw new IllegalArgumentException("Energy values cannot be negative.");
        }
    }
}