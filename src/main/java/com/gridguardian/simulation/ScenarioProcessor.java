package com.gridguardian.simulation;

import java.util.ArrayList;
import java.util.List;

public class ScenarioProcessor {

    public HourlyInput apply(
            HourlyInput input,
            List<ScenarioCondition> conditions
    ) {

        double demand = input.demandKwh();
        double solar = input.solarGenerationKwh();

        boolean gridAvailable = input.gridAvailable();
        boolean batteryAvailable = input.batteryAvailable();

        List<BuildingLoad> buildingLoads =
                new ArrayList<>(input.buildingLoads());

        for (ScenarioCondition condition : conditions) {

            if (!condition.appliesAt(input.hour())) {
                continue;
            }

            switch (condition.type()) {

                case NORMAL_DAY -> {
                }

                case CLOUDY_DAY ->
                        solar *= condition.factor();

                case GRID_OUTAGE ->
                        gridAvailable = false;

                case BATTERY_FAILURE ->
                        batteryAvailable = false;

                case DEMAND_SPIKE -> {

                    demand *= condition.factor();

                    List<BuildingLoad> updatedLoads =
                            new ArrayList<>();

                    for (BuildingLoad load : buildingLoads) {

                        updatedLoads.add(
                                new BuildingLoad(
                                        load.buildingType(),
                                        load.critical(),
                                        load.demandKwh()
                                                * condition.factor()
                                )
                        );
                    }

                    buildingLoads = updatedLoads;
                }
            }
        }

        return new HourlyInput(
                input.hour(),
                demand,
                buildingLoads,
                solar,
                gridAvailable,
                batteryAvailable,
                input.gridPricePerKwh()
        );
    }
}