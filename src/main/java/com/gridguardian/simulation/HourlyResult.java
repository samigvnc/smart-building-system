package com.gridguardian.simulation;

import java.util.List;

public record HourlyResult(
        int hour,
        double demandKwh,
        double solarAvailableKwh,
        double solarToLoadKwh,
        double solarToBatteryKwh,
        double batteryToLoadKwh,
        double gridToLoadKwh,
        double unservedEnergyKwh,
        double curtailedSolarKwh,
        double batterySocEndKwh,
        double cost,
        List<BuildingEnergyResult> buildingResults
) {

    public HourlyResult {

        if (buildingResults == null) {
            throw new IllegalArgumentException("Building results cannot be null.");
        }

        buildingResults = List.copyOf(buildingResults);
    }

    public HourlyResult(
            int hour,
            double demandKwh,
            double solarAvailableKwh,
            double solarToLoadKwh,
            double solarToBatteryKwh,
            double batteryToLoadKwh,
            double gridToLoadKwh,
            double unservedEnergyKwh,
            double curtailedSolarKwh,
            double batterySocEndKwh,
            double cost
    ) {
        this(
                hour,
                demandKwh,
                solarAvailableKwh,
                solarToLoadKwh,
                solarToBatteryKwh,
                batteryToLoadKwh,
                gridToLoadKwh,
                unservedEnergyKwh,
                curtailedSolarKwh,
                batterySocEndKwh,
                cost,
                List.of()
        );
    }
}