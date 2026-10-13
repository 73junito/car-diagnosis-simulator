insert into scenario_diagnostic_area_map (scenario_id, diagnostic_code, weight) values
('no-crank','ELECTRICAL',1),
('no-start','ENGINE_PERFORMANCE',1),
('overheating','ENGINE_REPAIR',1),
('electrical-load','ELECTRICAL',1),
('misfire','ENGINE_PERFORMANCE',1),
('steering-alignment','SUSPENSION_STEERING',1),
('hvac-cooling','HVAC',1),
('stalling','ENGINE_PERFORMANCE',1),
('misfire-9','ENGINE_PERFORMANCE',1),
('power-loss','ENGINE_PERFORMANCE',1),
('no-crank-11','ELECTRICAL',1),
('intermittent-starting','ELECTRICAL',1),
('charging-system','ELECTRICAL',1),
('can-bus-network','ELECTRICAL',1),
('hybrid-ev','HYBRID_EV',1),
('diesel-aftertreatment','ENGINE_PERFORMANCE',1),
('hybrid-ev-17','HYBRID_EV',1)
on conflict (scenario_id, diagnostic_code) do update set
  weight = excluded.weight;
