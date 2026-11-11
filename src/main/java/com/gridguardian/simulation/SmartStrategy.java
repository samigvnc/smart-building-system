package com.gridguardian.simulation;

import java.util.List;

public class SmartStrategy implements EnergyManagementStrategy {

    private final double minimumReservePercent;
    private final double highPriceThreshold;
    private final int outageLookAheadHours;

    private final BuildingEnergyAllocator allocator =
            new BuildingEnergyAllocator();

    public SmartStrategy() {
        this(
                25.0,
                2.5,
                3
        );
    }

    public SmartStrategy(
            double minimumReservePercent,
            double highPriceThreshold,
            int outageLookAheadHours
    ) {

        if (minimumReservePercent < 0
                || minimumReservePercent > 100) {
            throw new IllegalArgumentException(
                    "Minimum reserve must be between 0 and 100."
            );
        }

        if (highPriceThreshold < 0) {
            throw new IllegalArgumentException(
                    "High price threshold cannot be negative."
            );
        }

        if (outageLookAheadHours < 0) {
            throw new IllegalArgumentException(
                    "Outage look-ahead cannot be negative."
            );
        }

        this.minimumReservePercent =
                minimumReservePercent;

        this.highPriceThreshold =
                highPriceThreshold;

        this.outageLookAheadHours =
                outageLookAheadHours;
    }

    @Override
    public HourlyResult execute(
            StrategyContext context,
            Battery battery
    ) {

        HourlyInput input =
                context.input();

        double demand =
                input.demandKwh();

        double solar =
                input.solarGenerationKwh();

        double solarToLoad =
                Math.min(demand, solar);

        double remainingDemand =
                demand - solarToLoad;

        double remainingSolar =
                solar - solarToLoad;

        double solarToBattery = 0.0;

        if (input.batteryAvailable()) {
            solarToBattery =
                    battery.charge(remainingSolar);
        }

        double curtailedSolar =
                remainingSolar - solarToBattery;

        double batteryToLoad = 0.0;

        if (input.batteryAvailable()) {

            if (!input.gridAvailable()) {

                batteryToLoad =
                        battery.discharge(
                                remainingDemand
                        );

            } else if (!context.hasGridOutageStartingWithin(
                    outageLookAheadHours
            )) {

                if (input.gridPricePerKwh()
                        >= highPriceThreshold) {

                    double reserveKwh =
                            battery.getCapacityKwh()
                                    * minimumReservePercent
                                    / 100.0;

                    double availableAboveReserve =
                            Math.max(
                                    0.0,
                                    battery.getSocKwh()
                                            - reserveKwh
                            );

                    batteryToLoad =
                            battery.discharge(
                                    Math.min(
                                            remainingDemand,
                                            availableAboveReserve
                                    )
                            );
                }
            }

            remainingDemand -=
                    batteryToLoad;
        }

        double gridToLoad = 0.0;

        if (input.gridAvailable()) {
            gridToLoad =
                    remainingDemand;

            remainingDemand = 0.0;
        }

        double unservedEnergy =
                remainingDemand;

        double cost =
                gridToLoad
                        * input.gridPricePerKwh();

        double servedEnergy =
                demand - unservedEnergy;

        List<BuildingEnergyResult> buildingResults;

        if (!input.gridAvailable()) {
            buildingResults =
                    allocator.allocateCriticalFirst(
                            input.buildingLoads(),
                            servedEnergy
                    );
        } else {
            buildingResults =
                    allocator.allocateProportionally(
                            input.buildingLoads(),
                            servedEnergy
                    );
        }

        return new HourlyResult(
                input.hour(),
                input.demandKwh(),
                input.solarGenerationKwh(),
                solarToLoad,
                solarToBattery,
                batteryToLoad,
                gridToLoad,
                unservedEnergy,
                curtailedSolar,
                battery.getSocKwh(),
                cost,
                buildingResults
        );
    }
}