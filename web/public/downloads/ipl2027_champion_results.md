# Generated results (do not edit; produced by run.py)

Data cutoff: 2026-05-01. Final Elo params: {'k': 4, 'carry': 0.8, 'home': 20}; MLE (shrink, tau) = (1.25, 0).

## Match-level backtest (pooled, test seasons 2013-2026, pre-match & pre-toss except logreg_toss)

| model | n | log_loss | brier | auc | accuracy |
|---|---|---|---|---|---|
| coin | 882 | 0.6931 | 0.2500 | nan | nan |
| winpct | 882 | 0.6966 | 0.2516 | 0.5316 | 0.5257 |
| elo | 882 | 0.6942 | 0.2505 | 0.5266 | 0.5085 |
| logreg | 882 | 0.6988 | 0.2527 | 0.5155 | 0.4977 |
| gbm | 882 | 0.7188 | 0.2622 | 0.4818 | 0.4909 |
| ens_elo_lr | 882 | 0.6960 | 0.2514 | 0.5181 | 0.5057 |
| logreg_toss | 882 | 0.6985 | 0.2525 | 0.5200 | 0.5181 |

## Paired bootstrap: mean log-loss difference (negative = first model better)

| comparison | mean | lo95 | hi95 |
|---|---|---|---|
| elo - coin | 0.0010 | -0.0069 | 0.0098 |
| logreg - coin | 0.0057 | -0.0041 | 0.0167 |
| gbm - coin | 0.0257 | 0.0114 | 0.0402 |
| winpct - coin | 0.0034 | -0.0074 | 0.0140 |
| logreg - elo | 0.0046 | 0.0003 | 0.0088 |
| gbm - elo | 0.0247 | 0.0123 | 0.0373 |
| ens_elo_lr - elo | 0.0018 | -0.0003 | 0.0039 |
| logreg_toss - logreg | -0.0003 | -0.0021 | 0.0016 |

## Calibration (8 quantile bins)

### elo
| mean_pred | observed | n |
|---|---|---|
| 0.401 | 0.414 | 111 |
| 0.456 | 0.509 | 110 |
| 0.476 | 0.527 | 110 |
| 0.497 | 0.545 | 110 |
| 0.518 | 0.418 | 110 |
| 0.537 | 0.564 | 110 |
| 0.564 | 0.564 | 110 |
| 0.609 | 0.495 | 111 |

### logreg
| mean_pred | observed | n |
|---|---|---|
| 0.384 | 0.423 | 111 |
| 0.454 | 0.555 | 110 |
| 0.479 | 0.500 | 110 |
| 0.499 | 0.555 | 110 |
| 0.526 | 0.418 | 110 |
| 0.551 | 0.536 | 110 |
| 0.581 | 0.527 | 110 |
| 0.632 | 0.523 | 111 |

## Logistic regression coefficients (standardised, refit on 2009-2026)
{'elo_diff': 0.12, 'rrd_diff': 0.016, 'form_diff': -0.058, 'home': 0.093}

## Pre-tournament (frozen at season start) match predictions, pooled test seasons

| model | n | log_loss | brier | auc | accuracy |
|---|---|---|---|---|---|
| coin | 830 | 0.6931 | 0.2500 | nan | nan |
| pre_tournament | 830 | 0.6952 | 0.2510 | 0.5228 | 0.5060 |

| season | elo | shrink | tau | season_loglik | coin_loglik |
|---|---|---|---|---|---|
| 2013 | {'k': 2, 'carry': 0.5, 'home': 20} | 2.00 | 25 | -48.19 | -49.91 |
| 2014 | {'k': 6, 'carry': 1.0, 'home': 40} | 1.50 | 25 | -38.20 | -38.82 |
| 2015 | {'k': 10, 'carry': 0.9, 'home': 40} | 1.25 | 50 | -36.16 | -36.74 |
| 2016 | {'k': 8, 'carry': 1.0, 'home': 40} | 1.25 | 50 | -40.01 | -38.82 |
| 2017 | {'k': 6, 'carry': 1.0, 'home': 40} | 1.25 | 25 | -37.46 | -38.12 |
| 2018 | {'k': 6, 'carry': 1.0, 'home': 40} | 1.25 | 25 | -37.16 | -38.82 |
| 2019 | {'k': 6, 'carry': 1.0, 'home': 40} | 1.25 | 25 | -37.71 | -38.12 |
| 2020 | {'k': 6, 'carry': 1.0, 'home': 40} | 1.00 | 0 | -38.83 | -38.82 |
| 2021 | {'k': 6, 'carry': 1.0, 'home': 40} | 1.00 | 0 | -39.45 | -38.82 |
| 2022 | {'k': 4, 'carry': 1.0, 'home': 40} | 1.00 | 0 | -51.20 | -48.52 |
| 2023 | {'k': 4, 'carry': 0.9, 'home': 40} | 1.00 | 25 | -49.47 | -47.83 |
| 2024 | {'k': 4, 'carry': 0.9, 'home': 20} | 1.25 | 0 | -46.53 | -46.44 |
| 2025 | {'k': 4, 'carry': 0.9, 'home': 20} | 1.00 | 0 | -47.81 | -46.44 |
| 2026 | {'k': 4, 'carry': 0.8, 'home': 20} | 1.25 | 0 | -29.25 | -29.11 |

## Tournament backtest (pre-season title forecasts)

| variant | seasons | mean_log_p_champion | mean_log_uniform | mean_p_champion | playoff_brier | playoff_brier_uniform |
|---|---|---|---|---|---|---|
| bma | 13 | -2.013 | -2.157 | 0.148 | 0.245 | 0.247 |
| mle | 13 | -2.031 | -2.157 | 0.147 | 0.244 | 0.247 |

| season | n_teams | champion | p_champion | log_p_champion | rank_of_champion | playoff_brier | playoff_brier_uniform | log_uniform | favourite | p_favourite |
|---|---|---|---|---|---|---|---|---|---|---|
| 2013 | 9 | MI | 0.111 | -2.200 | 6 | 0.243 | 0.247 | -2.197 | RR | 0.133 |
| 2014 | 8 | KKR | 0.091 | -2.393 | 7 | 0.222 | 0.250 | -2.079 | CSK | 0.203 |
| 2015 | 8 | MI | 0.173 | -1.755 | 2 | 0.214 | 0.250 | -2.079 | CSK | 0.254 |
| 2016 | 8 | SRH | 0.131 | -2.031 | 3 | 0.221 | 0.250 | -2.079 | MI | 0.239 |
| 2017 | 8 | MI | 0.245 | -1.408 | 1 | 0.191 | 0.250 | -2.079 | MI | 0.245 |
| 2018 | 8 | CSK | 0.213 | -1.548 | 2 | 0.198 | 0.250 | -2.079 | MI | 0.226 |
| 2019 | 8 | MI | 0.188 | -1.670 | 2 | 0.223 | 0.250 | -2.079 | CSK | 0.290 |
| 2020 | 8 | MI | 0.223 | -1.502 | 2 | 0.296 | 0.250 | -2.079 | CSK | 0.280 |
| 2021 | 8 | CSK | 0.218 | -1.525 | 2 | 0.292 | 0.250 | -2.079 | MI | 0.274 |
| 2022 | 10 | GT | 0.074 | -2.610 | 5 | 0.308 | 0.240 | -2.303 | MI | 0.229 |
| 2023 | 10 | CSK | 0.122 | -2.102 | 1 | 0.217 | 0.240 | -2.303 | CSK | 0.122 |
| 2024 | 10 | KKR | 0.064 | -2.754 | 9 | 0.301 | 0.240 | -2.303 | CSK | 0.163 |
| 2025 | 10 | RCB | 0.069 | -2.676 | 10 | 0.254 | 0.240 | -2.303 | CSK | 0.123 |

## IPL 2027 forecast (20000 sims; MC s.e. of largest title prob ≈ 0.24 pp)

| team | name | elo_end_of_data | mu_2027_at_mle | p_playoffs | p_final | p_champion | exp_points |
|---|---|---|---|---|---|---|---|
| RCB | Royal Challengers Bengaluru | 1515.7 | 1515.7 | 45.9 | 24.5 | 12.9 | 14.5 |
| GT | Gujarat Titans | 1512.5 | 1512.5 | 46.0 | 24.4 | 12.2 | 14.5 |
| PBKS | Punjab Kings | 1506.6 | 1506.6 | 42.5 | 21.5 | 11.0 | 14.2 |
| KKR | Kolkata Knight Riders | 1496.0 | 1496.0 | 38.2 | 18.9 | 9.9 | 13.9 |
| SRH | Sunrisers Hyderabad | 1499.6 | 1499.6 | 39.3 | 19.4 | 9.8 | 13.9 |
| RR | Rajasthan Royals | 1498.6 | 1498.6 | 39.7 | 19.8 | 9.5 | 14.0 |
| DC | Delhi Capitals | 1495.6 | 1495.6 | 38.4 | 18.5 | 9.1 | 13.8 |
| LSG | Lucknow Super Giants | 1494.5 | 1494.5 | 38.0 | 18.4 | 8.9 | 13.8 |
| CSK | Chennai Super Kings | 1492.7 | 1492.7 | 36.8 | 17.8 | 8.4 | 13.7 |
| MI | Mumbai Indians | 1491.5 | 1491.5 | 35.3 | 16.8 | 8.2 | 13.6 |

Sum of champion probabilities: 1.0000

## Posterior over (shrink, tau) used for the 2027 mixture (top 10)

| shrink | tau | weight |
|---|---|---|
| 1.250 | 0 | 0.086 |
| 1.000 | 0 | 0.085 |
| 1.500 | 0 | 0.079 |
| 0.750 | 0 | 0.076 |
| 1.250 | 25 | 0.075 |
| 1.000 | 25 | 0.074 |
| 1.500 | 25 | 0.070 |
| 0.750 | 25 | 0.067 |
| 0.500 | 0 | 0.062 |
| 0.500 | 25 | 0.055 |

## Sensitivity of title probability to tau (shrink fixed at MLE)

| team | tau=0 | tau=50 | tau=100 | tau=150 |
|---|---|---|---|---|
| RCB | 0.133 | 0.127 | 0.120 | 0.117 |
| GT | 0.129 | 0.126 | 0.118 | 0.112 |
| PBKS | 0.113 | 0.113 | 0.110 | 0.104 |
| KKR | 0.090 | 0.091 | 0.092 | 0.092 |
| SRH | 0.095 | 0.096 | 0.095 | 0.095 |
| RR | 0.092 | 0.096 | 0.099 | 0.099 |
| DC | 0.092 | 0.092 | 0.096 | 0.099 |
| LSG | 0.088 | 0.089 | 0.090 | 0.097 |
| CSK | 0.085 | 0.085 | 0.090 | 0.090 |
| MI | 0.082 | 0.085 | 0.092 | 0.095 |