(function (root) {
  "use strict";
  // Plan 073: source-derived enum identities and predicates; initial controlled profile only.
  const MUSCLES = Object.freeze({"2545c6f170d88017a44bcd5bc21b8d98":"triceps","2545c6f170d8804bb1fbdfc4471debe5":"glutes","2545c6f170d88024b49fcea90e7d1ed9":"forearms","2545c6f170d880088132c5739103e625":"sideDelts","2545c6f170d88084b35affb3c3375aa6":"quads","2545c6f170d880768fc0ec766d080c01":"lowerBack","2545c6f170d8803d89bcf1ee5a11b23b":"abductors","2545c6f170d880a0ad32cd4e83834959":"adductors","2545c6f170d880a9899eec0e496c8cba":"rearDelts","2545c6f170d880da9b28f1e024be796b":"upperBack","2545c6f170d88021b648feb29a2427c2":"neck","2545c6f170d88060a50ec9b41a066a5d":"lats","2545c6f170d88002b193de9106604e79":"hamstrings","2545c6f170d880af953ace5a631c8cd2":"upperTraps","2545c6f170d8806aab76c6830449a3ff":"abs","2545c6f170d880349546e5d8f6df2e2a":"biceps","2545c6f170d880bbb34fc724d677176f":"calves","2545c6f170d8805f823bcfb076a74397":"chest","2545c6f170d8809a8fa7e24a77c25416":"frontDelts","27a5c6f170d880c39b2df5e861495666":"serratus","27a5c6f170d880a5baa9c716b240d0f6":"tibs","2545c6f170d8809da3f3cd80f2f14a4d":"obliques"});
  const MUSCLE_IDS = new Map(Object.entries(MUSCLES).map(([id, name]) => [name, id]));
  const PATTERNS = Object.freeze({"19f5c6f170d880ee8b1df7d40d87b961":"tricepsAccessory","2955c6f170d880c4af91d5f45c34dc48":"gluteMaxAccessory","19f5c6f170d880e8a7dae21508321c52":"forearmAccessories","31f5c6f170d88047b8f4e5db006555e2":"posteriorForearmAccessory","31f5c6f170d880c2a8c6d9f12cb4f55a":"anteriorForearmAccessory","19f5c6f170d8807dbb2adca997a03116":"lateralDeltAccessory","19f5c6f170d8801ba857e819c22df603":"quadAccessory","19f5c6f170d880c58cfce21635c82043":"lungeOrSplitSquatOrStepUpOrSingleLegSquat","2955c6f170d880949b02d1a6eb21937c":"lowerBackAccessory","19f5c6f170d88089826aff39aaece3c3":"hipAbductorAccessory","2955c6f170d880d4a418fec8fd5d48e5":"hipAdductorAccessory","2945c6f170d8806caf28f4702808811c":"rearDeltAccessory","2955c6f170d880e49400fa2d21c075a4":"upperBackAccessory","2945c6f170d88030ab99cfe4dc50a036":"neckAccessory","31f5c6f170d88011a56de8ead2c09e21":"neckFlexorAccessory","31f5c6f170d88074af04d3c9bda82e04":"neckExtensorAccessory","2945c6f170d880eb931efa3238d46d68":"latAccessory","19f5c6f170d880fcad8cf755a5ab9136":"hamstringAccessory","19f5c6f170d8803cb7b1ee9a4367eea0":"upperTrapAccessory","2955c6f170d880869adfde97dc8e3a24":"abAccessory","19f5c6f170d880c9b0f4d1c93d3718df":"bicepsAccessory","19f5c6f170d8800abc4bdf3144ab5aa0":"calfAccessory","19e5c6f170d8805c9eace37a0d0113f1":"chestAccessory","2955c6f170d880cf89acd93529ea254d":"frontDeltAccessory","2955c6f170d880078d36c5349955c2c3":"serratusAccessory","2f25c6f170d8801da332d3d8b61e179f":"tibialisAnteriorAccessory","2955c6f170d880e08663e0faa1b1983d":"obliqueAccessory","19e5c6f170d88009ba40c03d2f6271df":"horizontalPull","19e5c6f170d8808fbc7ffe35bc0bf0ca":"verticalPull","19e5c6f170d880d69589ce8bd1fde648":"horizontalPush","19e5c6f170d8805a8a1cf72d5e7a401f":"verticalPush","19e5c6f170d880f8ad63ffc686b1f1f9":"squat","19e5c6f170d88068951fd7fffc03ed0d":"hipHinge","31f5c6f170d88001bcafd91a189fee62":"miscForearm","3075c6f170d880e2813efcf6520a65bb":"other","2ed5c6f170d88051b7b5ed76db2dfced":"cardio","2955c6f170d880998e06dcbc6b385e79":"hipFlexorIsolation","2955c6f170d880b69d22c9a630965b5e":"ankleAccessory","2945c6f170d880b39945c94c571dd0f5":"throwPattern","2945c6f170d8809e85c2fa81d99ff24f":"grip","2945c6f170d8805e887bc0d89ba7c393":"olympicLiftVariation","19f5c6f170d880f2b621ce0f10c0c2d7":"shoulderRotationAccessories","19e5c6f170d8805984dbc321890bb90a":"coreStabilization","19e5c6f170d880b7978dd0c64a00ab72":"loadedCarry"});
  const TYPES = Object.freeze({"2095c6f170d880798c80daebcf85afd5":"singleJoint","2095c6f170d880cfaa50c22ebaf14a9d":"multiJoint","2495c6f170d8804a9298e4daeded2415":"core"});
  const REGIONS = Object.freeze({"2095c6f170d880f583cbe7e6c91cd8f7":"upperBody","2095c6f170d8807c86e8d22127eaa410":"lowerBody","2095c6f170d880dca6edc4ebf64c5b40":"core","2145c6f170d880399173f84224165c1b":"fullBody"});
  const DESCRIPTORS = Object.freeze({"2dc5c6f170d88157bb0bd7609d767bc6":"primaryCompound","2dc5c6f170d8814c8fcaf2e322abde4d":"secondaryCompound","2dc5c6f170d881faa946ee13702e7ea7":"isolationAccessory","2dc5c6f170d881bb9446fa6ca7c79655":"core","2dc5c6f170d881d5b938df3cdc31633a":"both","2dc5c6f170d881759504d74c4297516f":"bodyweightHomeEquipment","2dc5c6f170d88149a1c4eac565ce3bcc":"neither","2dc5c6f170d88104b6aee82f711b07b6":"hypertrophy","2dc5c6f170d881c2b1b2e521a6f0d0a2":"strength"});
  const ACTIONS = Object.freeze({"1925c6f170d880f79e40cda997e51df6":"kneeFlexion","1925c6f170d88062bfccfcc57a7aa559":"hipExtension","1925c6f170d8803e8da0f45646461d58":"kneeExtension","1c15c6f170d880bf9e5cf730d235b660":"inspiration","1c05c6f170d8802ea227e07291d9fe49":"adductionFifthMetatarsophalangealJoint","1bc5c6f170d8804788b6c9c74985455c":"na","1b55c6f170d880ea9e10ea0ba7ea8411":"gripping","19a5c6f170d8807782bbff64edd36360":"mandibularLateralDeviation","19a5c6f170d88057bf38fb56060914c3":"mandibularRetrusion","19a5c6f170d880a9bb5afeb3a3215c1b":"mandibularProtrusion","19a5c6f170d880a69a37fd7e9722c7b7":"larynxElevation","19a5c6f170d880e581c3fa21504a6775":"larynxDepression","19a5c6f170d8800ab920da6d2bfb2112":"elevatesFloorOfMouth","19a5c6f170d88092be97f6819e81a97f":"lipElevation","19a5c6f170d88008ad41dbe38742c169":"elevatesAngleOfMouth","19a5c6f170d88026bc37ebf451310bed":"mandibularElevation","19a5c6f170d880e4aba2c2aea4cc0b63":"lipDepression","19a5c6f170d8807291b7e70bfcb2107a":"depressesAngleOfMouth","19a5c6f170d880619331c82fec3f0a9a":"tensesNeckSkin","19a5c6f170d880a5a8f2ded156276fcc":"hyoidDepression","19a5c6f170d880518d42ee606c289223":"mandibularDepression","19a5c6f170d880e29279d88f23c5fff0":"hyoidElevation","19a5c6f170d8806197b1f461d0584fd9":"sternoclavicularJointStabilization","19a5c6f170d880e6b04ce097a4cc60d5":"tensesLineaAlba","1985c6f170d88045bd59fd02d5545097":"ribElevation","1985c6f170d880739a5fd9b69264a795":"ribDepression","1985c6f170d8806ab3a2e68c799dcc27":"flexionDistalInterphalangealJointsToes","1985c6f170d880eb83bcdd4c32d0f1fc":"extensionDistalInterphalangealJointsToes","1985c6f170d880b18fa7c4a3b21fd3e0":"extensionProximalInterphalangealJointsToes","1985c6f170d880edb429d9b7f2b298e5":"flexionProximalInterphalangealJointsToes","1985c6f170d88093a035f6a6250ba3cc":"metatarsophalangealJointAdduction","1985c6f170d880858543d30a93541a00":"metatarsophalangealJointAbduction","1985c6f170d880fc8fbec254de489976":"metatarsophalangealJointExtension","1985c6f170d880d98666e228c3ac5bf7":"metatarsophalangealJointFlexion","1975c6f170d8800a9887f72a95fba894":"acromioclavicularDownwardRotation","1975c6f170d8805b96fed4661a2fea26":"acromioclavicularUpwardRotation","1975c6f170d88071a906e3e539557b78":"sternoclavicularRetraction","1975c6f170d8808e8546c016152d0be8":"sternoclavicularProtraction","1975c6f170d8800f830fee3b5666aecf":"sternoclavicularDepression","1975c6f170d880cda7b8e87c9b8cf86a":"sternoclavicularElevation","1965c6f170d88005a466d7053139f605":"extensionDistalInterphalangealJointsFingers245","1965c6f170d880acb634ed943fba834e":"extensionDistalInterphalangealJointsFingers24","1965c6f170d8802681ddd695190b7361":"extensionProximalInterphalangealJointsFingers24","1965c6f170d8802ba264f9fa7930714f":"extensionProximalInterphalangealJointsFingers245","1965c6f170d880a69236c90249cd6324":"flexionMetacarpophalangealJoints24","1965c6f170d880e99e77e9db3c8f77d8":"flexionMetacarpophalangealJoints245","1965c6f170d880e4bf0dffe689b0ed83":"abductionMetacarpophalangealJoints24","1965c6f170d88016aa0fe33189fa5503":"adductionMetacarpophalangealJoints245","1965c6f170d8807487aef4d65447a310":"fifthMetacarpophalangealJointAbduction","1965c6f170d880e6bd98e7735c4b361a":"fifthMetacarpophalangealJointFlexion","1965c6f170d880f0b7ecc01121a1f49c":"secondMetacarpophalangealJointExtension","1965c6f170d8801883a5f84936022e49":"firstMetacarpophalangealJointExtension","1965c6f170d8809aa79cc17251fda6c0":"extensionDistalInterphalangealJointSecondFinger","1965c6f170d88053be76fc19f9905234":"extensionProximalInterphalangealJointSecondFinger","1965c6f170d880c1b560cd5af7d1f009":"extensionDistalInterphalangealJointFifthFinger","1965c6f170d8805ab522e37ee8994cb8":"extensionProximalInterphalangealJointFifthFinger","1965c6f170d8806ab486c02b734f6916":"fifthMetacarpophalangealJointExtension","1965c6f170d880aeb0f1df16ddb1e878":"extensionDistalInterphalangealJointsFingers25","1965c6f170d8806b91c6ce8c69033c56":"extensionProximalInterphalangealJointsFingers25","1965c6f170d8800ba1cdc19b447f5704":"extensionMetacarpophalangealJoints25","1965c6f170d880bbb99fd055a1ec5585":"firstMetacarpophalangealJointFlexion","1965c6f170d880758b1fd68e8249b278":"flexionDistalInterphalangealJointsFingers25","1965c6f170d88005adf1e5abe34dec21":"flexionProximalInterphalangealJointsFingers25","1965c6f170d880e591b4fcbd945bc107":"flexionMetacarpophalangealJoints25","1965c6f170d880b6a6c4d98d4d3566a8":"neckRotation","1965c6f170d8801f8fe3ffaa2403df65":"intraabdominalCompression","1965c6f170d880c995a2ffd575d13557":"trunkRotation","1955c6f170d880b5b535da0f68ac066a":"neckFlexion","1955c6f170d88059b603db87c750e01f":"neckSideBending","1955c6f170d8804a998aebe6e4c32086":"neckExtension","1955c6f170d8800fba01dfe1f4d99006":"flexionDistalInterphalangealJointsToes25","1955c6f170d88069b070cba22fdd3848":"extensionMetatarsophalangealJoints25","1955c6f170d8801e99c5c01aeff68025":"extensionProximalInterphalangealJointsToes24","1955c6f170d880368040d8cb0f11b475":"extensionMetatarsophalangealJoints24","1955c6f170d880b7ac50ead64767704c":"fifthMetatarsophalangealJointExtension","1955c6f170d880639102fec5a76fa96d":"greatToeInterphalangealJointFlexion","1955c6f170d8806db15bdb632c64994c":"greatToeInterphalangealJointExtension","1955c6f170d88045baaadae91c43fa43":"firstMetatarsophalangealJointExtension","1945c6f170d88046a6fef4352ccc7431":"flexionProximalInterphalangealJointsToes25","1945c6f170d880a49477c25e14018a7b":"flexionMetatarsophalangealJoints25","1945c6f170d880e58cd7c925e97e0b5d":"extensionDistalInterphalangealJointsToes25","1945c6f170d880afa5d4eb3a89f8d28f":"extensionProximalInterphalangealJointsToes25","1945c6f170d880f98d7ed516cda18dfe":"firstMetatarsophalangealJointAdduction","1945c6f170d880e59d00c248d7a395b7":"fifthMetatarsophalangealJointFlexion","1945c6f170d880258e3ce241269bcda8":"flexionFifthMetatarsophalangealJoint","1945c6f170d880bbb446d28374addd3f":"abductionFifthMetatarsophalangealJoint","1945c6f170d8808ea58bf29cff7b6c65":"extensionProximalInterphalangealJointsToes35","1945c6f170d88036aa5dc0a59c264211":"extensionDistalInterphalangealJointsToes35","1945c6f170d880d0aa33d90b4ed6bf86":"flexionMetatarsophalangealJoints35","1945c6f170d88042a477ea9b3f942049":"adductionMetatarsophalangealJoints35","1945c6f170d880ddbd3fd09dd4f36ee0":"extensionDistalInterphalangealJointsToes24","1945c6f170d8804bac06d79c1efffe99":"flexionMetatarsophalangealJoints24","1945c6f170d880a3887acfa4bfa5cc81":"abductionMetatarsophalangealJoints24","1935c6f170d880ddb2e1ff6a535f51ca":"firstMetatarsophalangealJointFlexion","1935c6f170d880ac9b88ebc86db1c86f":"firstMetatarsophalangealJointAbduction","1935c6f170d880a19cd1fa34cf3f2ae4":"tibialExternalRotation","1935c6f170d880fc812ddf6f5068fd11":"trunkExtension","1935c6f170d880128008e8312963bee8":"trunkFlexion","1925c6f170d8809886befcc5e20aee0c":"trunkSideBending","1925c6f170d880aeb5f5c6ba8cd0132e":"ankleEversion","1925c6f170d880a5aa3bdcb158e04888":"ankleDorsiflexion","1925c6f170d880719101d02e75f0d2e2":"ankleInversion","1925c6f170d880cf8af6f201727daf37":"anklePlantarflexion","1925c6f170d880579224c81211c721bb":"tibialInternalRotation","1925c6f170d88000ba1fcfa09fe79089":"hipAdduction","1925c6f170d8803fa97cfb931a45d24a":"hipFlexion","1925c6f170d88092bac6f26bf0964699":"hipInternalRotation","1925c6f170d8805293ffcb43b6fc89c1":"hipAbduction","1925c6f170d8801bbcadefbb73612f9a":"hipExternalRotation","1925c6f170d880228647ccbb57df01e4":"shoulderStabilization","1905c6f170d8802ca574d77e35f9da59":"elbowJointStabilization","1905c6f170d880f294cafcd777cea30b":"tighteningPalmarAponeurosis","1905c6f170d880bab049d2b032d5129f":"fifthCarpometacarpalJointOpposition","1905c6f170d88036b8abc978073ee6bb":"firstCarpometacarpalJointOpposition","1905c6f170d880e6b229ed8e38bbc60a":"firstCarpometacarpalJointAdduction","1905c6f170d880629e4acd92f7cb3edf":"firstCarpometacarpalJointAbduction","1905c6f170d880db9343d7816b6ac4a3":"firstCarpometacarpalJointExtension","1905c6f170d88067af93ce074fa6a62f":"firstCarpometacarpalJointFlexion","1905c6f170d880d78a96c2c112e3ad8b":"thumbInterphalangealJointExtension","1905c6f170d88034b0a6e0852823c1b8":"thumbInterphalangealJointFlexion","1905c6f170d8803fbfd4ddef88f12461":"shoulderHorizontalExtension","1905c6f170d8807da7cbe15ce2e280e0":"shoulderHorizontalFlexion","1905c6f170d880b6b24df2205839e851":"scapularDownwardRotation","1905c6f170d8805bb1eae8711816d7b4":"scapularUpwardRotation","1905c6f170d8807d949bf6b45a8427eb":"scapularProtraction","1905c6f170d880e58c1add9b4d1aa1df":"shoulderGirdleRetraction","1905c6f170d8803cb8fcee63d3654c78":"shoulderGirdleElevation","1905c6f170d88046a033ef75307802b2":"shoulderGirdleDepression","1905c6f170d88074a816ec09084e171b":"flexionDistalInterphalangealJointsFingers","1905c6f170d8805aaafccb73c2e5572c":"flexionProximalInterphalangealJointsFingers","1905c6f170d8801b8c38f8b5d5ce8fcb":"metacarpophalangealJointAdduction","1905c6f170d880889315ce25a54b26cc":"metacarpophalangealJointAbduction","1905c6f170d8804880edddd27fcd4bed":"metacarpophalangealJointExtension","1905c6f170d880629636fb0011d023a3":"metacarpophalangealJointFlexion","1905c6f170d880858e57dfbe7bcbdd26":"wristAdductionUlnarDeviation","1905c6f170d8804ea7f7ca11139f7aa9":"wristAbductionRadialDeviation","1905c6f170d880b98fbfcf9275ffa1f0":"wristExtension","1905c6f170d8803d9a8bf6cb101e19b9":"wristFlexion","1905c6f170d880548371f5cae70e42fa":"shoulderInternalRotation","1905c6f170d880dea666c58a67814a57":"shoulderExternalRotation","1905c6f170d88069a35ed01745df8091":"shoulderAdduction","1905c6f170d8809f8fd4dd2ac78e6401":"shoulderAbduction","1905c6f170d880c39dc6d94d204eaaf4":"shoulderExtension","1905c6f170d880f9a3e9c893a372a978":"shoulderFlexion","1905c6f170d8803da1e0f2355421739c":"forearmRadioulnarSupination","1905c6f170d8809c839de760e6385702":"forearmRadioulnarPronation","1905c6f170d8807d9955dd5c5e353cb5":"elbowExtension","18f5c6f170d88099b961c96fc9f928d9":"elbowFlexion"});
  const CATEGORIES = Object.freeze({"27d5c6f170d880c98b12d98b8cbc09a9":"loadableBars","2875c6f170d8805cab15e3d2256d4f34":"loadableAccessories","27d5c6f170d880e7a81ed016e8544f87":"plateLoadedMachines","27d5c6f170d880858a16cbe59b77ec91":"bandsAndRopes","2805c6f170d880949f7df6b53dfd58e9":"fixedWeightBars","27d5c6f170d880e982f8e88bc9b9b42d":"bodyWeights","27d5c6f170d880759164fde844c2531c":"freeWeights","27d5c6f170d880c0a69eeb509e3b5c07":"cableMachines","27d5c6f170d8808fb2f2eb98af74e610":"pinLoadedMachines","27d5c6f170d88068994dd20bd949db24":"accessoriesAndFunctional","27d5c6f170d880e88064df17bfa513a2":"benchesAndRacks","2ed5c6f170d880a7b444c0ad55eaffc3":"cardio","27d5c6f170d8806aabc4c49ffb96724a":"other"});
  const PATTERN_MUSCLES = Object.freeze({"abAccessory":"abs","ankleAccessory":null,"anteriorForearmAccessory":"forearms","bicepsAccessory":"biceps","calfAccessory":"calves","cardio":null,"chestAccessory":"chest","coreStabilization":null,"forearmAccessories":"forearms","frontDeltAccessory":"frontDelts","gluteMaxAccessory":"glutes","grip":null,"hamstringAccessory":"hamstrings","hipAbductorAccessory":"abductors","hipAdductorAccessory":"adductors","hipFlexorIsolation":null,"hipHinge":null,"horizontalPull":null,"horizontalPush":null,"latAccessory":"lats","lateralDeltAccessory":"sideDelts","loadedCarry":null,"lowerBackAccessory":"lowerBack","lungeOrSplitSquatOrStepUpOrSingleLegSquat":"quads","miscForearm":null,"neckAccessory":"neck","neckExtensorAccessory":"neck","neckFlexorAccessory":"neck","obliqueAccessory":"obliques","olympicLiftVariation":null,"other":null,"posteriorForearmAccessory":"forearms","quadAccessory":"quads","rearDeltAccessory":"rearDelts","serratusAccessory":"serratus","shoulderRotationAccessories":null,"squat":null,"throwPattern":null,"tibialisAnteriorAccessory":"tibs","tricepsAccessory":"triceps","upperBackAccessory":"upperBack","upperTrapAccessory":"upperTraps","verticalPull":null,"verticalPush":null});
  const MUSCLE_REGIONS = Object.freeze({"triceps":"upper","glutes":"lower","forearms":"upper","sideDelts":"upper","quads":"lower","lowerBack":"lower","abductors":"lower","adductors":"lower","rearDelts":"upper","upperBack":"upper","neck":"upper","lats":"upper","hamstrings":"lower","upperTraps":"upper","abs":null,"biceps":"upper","calves":"lower","chest":"upper","frontDelts":"upper","serratus":"upper","tibs":"lower","obliques":null});
  const ASSESSMENTS = Object.freeze({"2925c6f170d88037b3d9c22ff48a9988":["pullUps10"],"1a15c6f170d88037945ece29e66bdf4d":["pullUps10"],"1a15c6f170d880bf8710e3cf4209936d":["pullUps10"],"1a15c6f170d880849033e0f75c6ee758":["pullUps10"],"2ad5c6f170d8804aa21df1e164192910":["pullUps10"],"1ea5c6f170d88048b560ff1639535e0c":["pullUps10"],"1ea5c6f170d8809588bbf87798d8f746":["pullUps10"],"1ea5c6f170d8803fad6deac6a44ac402":["pullUps10"],"1a15c6f170d88095abb8c0c1b69b7157":["pullUps10"],"1a15c6f170d880009c83d4273fef90bd":["pullUps10"],"1a15c6f170d8807dbb6ef4be8153acaa":["pullUps10"],"2ad5c6f170d880cdbed1eaa8667aec1c":["pullUps10"],"2815c6f170d88084baa6d985c5689827":["pullUps5","pullUps10"],"1a15c6f170d880b6adcbff83e8bb6b0f":["pullUps5","pullUps10"],"1a15c6f170d8808281eec44bc9b7fd67":["pullUps5","pullUps10"],"1a15c6f170d880a6adc9fcb38e55b8a9":["pullUps5","pullUps10"],"2945c6f170d880c5982df5f0136baa88":["dips10"],"2945c6f170d880fd847ade9bb93afd91":["dips10"],"26c5c6f170d8801f872af3c4774900c5":["dips10"],"26c5c6f170d8803385dbcb10335259f6":["dips10"],"1a05c6f170d8807b815ed7c1a7370575":["dips10"],"1a05c6f170d88094ba6ac1b79ded4cf9":["dips10"],"1a05c6f170d880dfb155db9048527b8b":["dips10"],"2945c6f170d880e0a4d5eb4a81d26159":["dips10"],"2945c6f170d8804492cdd8fcac26dbfb":["dips10"],"26c5c6f170d8808eb3fad30d37bdc3c3":["dips10"],"26c5c6f170d8802ab4ede83743a22611":["dips10"],"1a05c6f170d880c192f3c4c1c2fbbcba":["dips10"],"1a05c6f170d880b59c2ec135e3c3e9f6":["dips10"],"24d5c6f170d880e19102db0e4a0cb942":["overheadPress10"],"1a05c6f170d8803c86effb7acb6ade56":["overheadPress10"],"1a05c6f170d8806c83bac84cb4b90d45":["overheadPress10"],"1a05c6f170d880db967edeae7b23fd4f":["overheadPress10"],"1a05c6f170d8802d9233da6c4897b8e7":["overheadPress10"],"1a05c6f170d880c5ad11c99b302b1bf9":["overheadPress10"],"1a05c6f170d880b1a11cd1e875b32025":["inclinePress10"],"1a05c6f170d8809da1e7fbc50ae7575b":["inclinePress10"],"1a05c6f170d8807590e2d79fc558e368":["inclinePress10"],"1a05c6f170d880198e1aceac084f30eb":["inclinePress10"],"2a15c6f170d8803dbc49fa71c1995ec8":["pushUps15"],"2335c6f170d880b3bf05fbd3fe896667":["pushUps15"],"1a15c6f170d880dfacd1c620c1010d79":["pushUps15"],"1a05c6f170d880cd8e13ef0e0d5a4637":["pushUps15"],"1a05c6f170d880a5b43fe13bcb1b6f3a":["pushUps15"],"2335c6f170d8806ca3efcb9b8fa09e94":["pushUps15"],"1a05c6f170d880dfb02cf76f7519927d":["pushUps15"],"2305c6f170d8809683abf39935685d38":["pushUps15"],"1a05c6f170d8808092c2da8955b361f1":["pushUps15"],"2325c6f170d880148924f4d544fa58ed":["pushUps15"],"2315c6f170d8808181a4f18d581bd552":["pushUps15"],"1a05c6f170d88091bae1f8c38abe474e":["pushUps15"],"2375c6f170d880f38392de77de639de7":["benchPress10"],"2375c6f170d88097a709c94ec5d3e9fc":["benchPress10"],"1a05c6f170d880c09936def7e47899b1":["benchPress10"],"1a05c6f170d88055b31ddbc6338d7074":["benchPress10"],"1a05c6f170d88051a776c0d609819787":["benchPress10"],"1a05c6f170d8807c9f16f226db24074d":["benchPress10"],"19f5c6f170d8808bb424e98de4472a7e":["benchPress10"],"19f5c6f170d88013ae78cc9e6c967813":["benchPress10"],"1a05c6f170d88064bb2ede3eb9413258":["benchPress10"],"2ab5c6f170d88077bf41c329e79f07b9":["benchPress10"],"2425c6f170d880eda736d987feaeb08b":["benchPress10"]});
  const CAPABILITY_KEYS = Object.freeze({pullUps10:"pullups10",pullUps5:"pullups5",pushUps15:"pushups15",inclinePress10:"inclineBarbell10",overheadPress10:"overheadPress10",dips10:"bodyweightDips10",benchPress10:"benchPress10"});
  const NORMAL = "1a45c6f170d880629cdcc99a2ff615cf", PLATES = "25a5c6f170d880c1a55ac08cf52671ab";
  const BUMPER = "25d5c6f170d880eba241c26f8f426024", BUMPERS = "25a5c6f170d8805b8c95e7e5b4e8a989", BODY = "19e5c6f170d880ec8238f837c5284019";
  const overlap = (a, b) => a.some((value) => b.includes(value));
  const ascii = (a, b) => a < b ? -1 : a > b ? 1 : 0;
  function create(catalog, request, hardAllowed) {
    if (typeof hardAllowed !== "function") throw new TypeError("hardAllowed is required");
    if (!["hybrid", "hypertrophy"].includes(request.goal) || request.experience !== "advanced") throw new RangeError("Unsupported initial candidate profile");
    if (request.gymProfile?.equipmentConfigById && Object.keys(request.gymProfile.equipmentConfigById).length) throw new RangeError("Unsupported equipment overrides");
    if (request.gymProfile?.useBumperPlatesInPlateCalculator != null) throw new RangeError("Unsupported bumper override");
    if (request.history !== undefined && (!Array.isArray(request.history) || request.history.length)) throw new RangeError("Unsupported history input");
    const index = catalog.uuidIndex;
    const selectedEquipment = request.gymProfile?.equipmentIds;
    if (!Array.isArray(selectedEquipment) || selectedEquipment.some((id) => index[id]?.type !== "equipment")) throw new TypeError("Invalid equipment IDs");
    if (request.gymProfile.equipmentLoadsKg && Object.keys(request.gymProfile.equipmentLoadsKg).length) throw new RangeError("Unsupported equipment overrides");
    function muscles(ids) {
      return [...new Set(ids || [])].sort(ascii).map((id) => {
        if (!MUSCLES[id] || index[id]?.type !== "featureMuscleGroup") throw new TypeError("Invalid muscle UUID");
        return MUSCLES[id];
      });
    }
    const priorities = muscles(request.emphasisMuscleIds), depriorities = muscles(request.deprioritizedMuscleIds);
    if (overlap(priorities, depriorities)) throw new RangeError("contradictory muscle priorities");
    const assessments = Object.keys(CAPABILITY_KEYS).filter((name) => request.competencyAnswers?.[CAPABILITY_KEYS[name]] === true);
    const useBumper = selectedEquipment.includes(BUMPER);
    function equipment(id) {
      const item = index[id];
      if (item?.type !== "equipment") throw new TypeError("Missing equipment UUID");
      return item;
    }
    function category(id) { return CATEGORIES[equipment(id).category] || null; }
    const isBase = (id) => ["loadableBars", "loadableAccessories", "plateLoadedMachines"].includes(category(id));
    function resistance(groupId) {
      const group = index[groupId];
      if (group?.type === "equipment") return { base: groupId, loading: ["loadableBars", "plateLoadedMachines"].includes(category(groupId)) ? [PLATES] : [] };
      if (group?.type !== "resistanceEquipmentGroup" || !Array.isArray(group.equipment) || !group.equipment.length) throw new TypeError("Invalid resistance group");
      const ids = [...group.equipment];
      if (ids.length === 1 && ["loadableBars", "plateLoadedMachines"].includes(category(ids[0]))) ids.push(PLATES);
      if (ids.length === 1) return { base: ids[0], loading: [] };
      const base = ids.find(isBase);
      if (!base) throw new TypeError("Resistance group lacks base");
      return { base, loading: ids.filter((id) => !isBase(id)) };
    }
    function canonical(id) { return equipment(id).pluralOf ?? id; }
    function available(ids) {
      if (ids.length === 1 && ids[0] === BODY) return true;
      const required = ids.map(canonical);
      if (required.includes(NORMAL) && required.includes(BUMPER)) required.splice(required.indexOf(BUMPER), 1);
      return required.every((id) => selectedEquipment.includes(id) || (id === NORMAL && useBumper));
    }
    function resistanceIds(group) {
      const ids = [group.base, ...group.loading];
      if (useBumper && group.loading.includes(PLATES)) ids.push(BUMPERS);
      return ids;
    }
    function gymAllowed(raw) {
      const res = raw.resistanceEquipmentGroupIds || [], sup = raw.supportEquipmentGroupIds || [];
      return (!res.length || res.some((id) => available(resistanceIds(resistance(id))))) && (!sup.length || sup.some((id) => {
        const group = index[id];
        if (group?.type === "equipment") return available([id]);
        if (group?.type !== "supportEquipmentGroup" || !Array.isArray(group.equipment)) throw new TypeError("Invalid support group");
        return available(group.equipment);
      }));
    }
    function resolve(raw) {
      const patterns = (raw.movementPattern || []).map((id) => PATTERNS[id]).filter(Boolean);
      const region = REGIONS[raw.regionTrained] ?? null;
      let effectiveRegion = region;
      if (region === "core") {
        const mapped = patterns.map((pattern) => PATTERN_MUSCLES[pattern]);
        if (!mapped.some((muscle) => muscle === "abs" || muscle === "obliques")) {
          const first = mapped.map((muscle) => MUSCLE_REGIONS[muscle]).find((value) => value != null);
          effectiveRegion = first === "upper" ? "upperBody" : first === "lower" ? "lowerBody" : "core";
        }
      }
      return Object.freeze({ id: raw.id, raw, patterns, region, effectiveRegion, exerciseType: TYPES[raw.exerciseType] ?? null,
        primaryJointActions: (raw.primaryJointAction || []).map((id) => ACTIONS[id]).filter(Boolean), exclusionGroupings: raw.exclusionGroupings || [] });
    }
    const seenIds = new Set();
    const exercises = catalog.exercises.map((raw) => {
      if (seenIds.has(raw.id)) throw new TypeError("Duplicate exercise UUID");
      seenIds.add(raw.id); return resolve(raw);
    });
    const pool = exercises.filter((exercise) => {
      const required = ASSESSMENTS[exercise.id];
      if (required ? !overlap(required, assessments) : (exercise.raw.preconditions || []).length) return false;
      return gymAllowed(exercise.raw) && hardAllowed(exercise.raw);
    });
    function variant(exercise, muscle) {
      const p = exercise.patterns, actions = exercise.primaryJointActions;
      if (muscle === "forearms" || muscle === "neck") {
        if (overlap(p, ["anteriorForearmAccessory", "neckFlexorAccessory"])) return true;
        if (overlap(p, ["posteriorForearmAccessory", "neckExtensorAccessory"])) return false;
      } else if (muscle === "lats" && p.includes("latAccessory")) {
        if (exercise.exerciseType === "singleJoint") return true;
        if (exercise.exerciseType === "multiJoint") return false;
      } else if (muscle === "quads") {
        if (actions.includes("kneeExtension") && p.includes("quadAccessory")) return true;
        if (p.includes("lungeOrSplitSquatOrStepUpOrSingleLegSquat")) return false;
      } else if (muscle === "hamstrings" && p.includes("hamstringAccessory")) {
        if (actions.includes("kneeFlexion")) return true;
        if (actions.includes("hipExtension")) return false;
      }
      return null;
    }
    function accessoryAllowed(exercise, muscle, selected) {
      if (!exercise.patterns.some((pattern) => PATTERN_MUSCLES[pattern] === muscle)) return false;
      const relevant = selected.filter((template) => {
        if ((muscle === "lats" || muscle === "quads") && (template.type !== "accessory" || template.accessoryMuscle !== muscle)) return false;
        return template.exercise.patterns.some((pattern) => PATTERN_MUSCLES[pattern] === muscle);
      }).map((template) => template.exercise);
      let want;
      if (muscle === "lats") want = relevant.length === 0 || relevant.length === 2;
      else if (muscle === "quads") want = relevant.length === 0 || relevant.length === 2 || relevant.length === 4;
      else if (muscle === "forearms") want = !relevant.length || variant(relevant.at(-1), muscle) !== true;
      else if (muscle === "neck") want = !!relevant.length && variant(relevant.at(-1), muscle) === false;
      else if (muscle === "hamstrings") want = !(relevant.length >= 2 && relevant.slice(-2).every((item) => variant(item, muscle) === true));
      else return true;
      return variant(exercise, muscle) === want;
    }
    function choose(spec, selected) {
      if (!["primary", "secondary", "accessory"].includes(spec.type) || !Array.isArray(selected)) throw new TypeError("Invalid template specification");
      const accessory = spec.type === "accessory";
      if (accessory ? !Object.values(MUSCLES).includes(spec.muscle)
        : typeof spec.isFirstOfType !== "boolean" || !["horizontalPush", "verticalPush", "horizontalPull", "verticalPull", "squat", "hipHinge", "hinge"].includes(spec.pattern)) throw new TypeError("Invalid template specification");
      const descriptor = accessory ? "isolationAccessory" : spec.type === "primary" ? "primaryCompound" : "secondaryCompound";
      const pattern = spec.pattern === "hinge" ? "hipHinge" : spec.pattern;
      const strength = request.goal === "strength" || (request.goal === "hybrid" && spec.type === "primary");
      const tierField = `${strength ? "strength" : "hypertrophy"}${accessory ? "Accessory" : spec.type === "primary" ? "PrimaryCompound" : "SecondaryCompound"}RecommendationLevel`;
      const groups = new Map();
      for (const candidate of pool) {
        const raw = candidate.raw;
        const classifications = raw[strength ? "exerciseClassificationStrength" : "exerciseClassificationHypertrophy"] || [];
        if (!classifications.some((id) => DESCRIPTORS[id] === descriptor) || raw[tierField] == null) continue;
        if (accessory ? !accessoryAllowed(candidate, spec.muscle, selected) : !candidate.patterns.includes(pattern)) continue;
        let score = raw[tierField];
        if (!Number.isFinite(score)) throw new TypeError("Invalid recommendation tier");
        if (!accessory) {
          const emphasized = (raw.emphasizedAgonist || []).map((id) => MUSCLES[id]);
          if (overlap(emphasized, priorities)) score -= 1;
          if (overlap(emphasized, depriorities)) score += 1;
          if (spec.isFirstOfType && overlap((raw.deemphasizedAgonist || []).map((id) => MUSCLES[id]), priorities)) score += 1;
        }
        if (!groups.has(score)) groups.set(score, []);
        groups.get(score).push(candidate);
      }
      const ordered = [...groups.entries()].sort((a, b) => a[0] - b[0])
        .map(([score, values]) => [score, values.filter((candidate) => !selected.some((template) => template.exercise === candidate))]);
      const overlapCount = (candidate) => selected.filter((template) => overlap(candidate.exclusionGroupings, template.exercise.exclusionGroupings)).length;
      const equipmentBases = (candidate) => (candidate.raw.resistanceEquipmentGroupIds || []).map((id) => canonical(resistance(id).base));
      const equipmentCount = (candidate) => selected.filter((template) => overlap(equipmentBases(candidate), equipmentBases(template.exercise))).length;
      for (let start = 0; start < ordered.length; start += 2) {
        for (const level of [0, 1, 2]) {
          for (const [, values] of ordered.slice(start, start + 2)) {
            let survivors = values.filter((candidate) => level === 2 || overlapCount(candidate) === level);
            if (!survivors.length) continue;
            if (level !== 0) {
              const minimum = Math.min(...survivors.map(equipmentCount));
              survivors = survivors.filter((candidate) => equipmentCount(candidate) === minimum);
            }
            const preferred = survivors.filter((candidate) => (request.preferredExerciseIds || []).includes(candidate.id));
            return (preferred.length ? preferred : survivors).sort((a, b) => ascii(a.id, b.id))[0];
          }
        }
      }
      return null;
    }
    return Object.freeze({ choose, muscleId: (name) => MUSCLE_IDS.get(name), priorities: Object.freeze(priorities), depriorities: Object.freeze(depriorities) });
  }
  const api = Object.freeze({ create });
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  if (root) root.RepForgeGenerationCandidates = api;
})(typeof window !== "undefined" ? window : globalThis);
