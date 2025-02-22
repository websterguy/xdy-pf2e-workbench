/**
 * Entrypoint for xdy-pf2e-workbench.
 * Author: xdy (Jonas Karlsson)
 * Content License: See LICENSE and README.md for license details
 * Software License: Apache 2.0
 */

//TODO Make it so holding shift pops up a dialog where one can change the name of the mystified creature
//TODO Add an option to have the 'demystify' button post a message to chat/pop up a dialog with demystification details (e.g. pretty much the recall knowledge macro), with the chat button doing the actual demystification.
//TODO Make the button post a chat message with a properly set up RK roll that players can click, as well as a gm-only button on the message that the gm can use to actually unmystify.
import { preloadTemplates } from "./preloadTemplates";
import { registerSettings } from "./settings";
import { mangleChatMessage, renderNameHud, tokenCreateMystification } from "./feature/tokenMystificationHandler";
import { registerKeybindings } from "./keybinds";
import { autoRollDamage, persistentDamage, persistentHealing } from "./feature/damageHandler";
import { deprecatedMoveManually, moveOnDying, moveOnZeroHP } from "./feature/initiativeHandler";
import { ActorPF2e } from "@actor";
import { ChatMessagePF2e } from "@module/chat-message";
import { CombatantPF2e, EncounterPF2e } from "@module/encounter";
import { TokenDocumentPF2e } from "@scene";
import { playAnimationAndSound } from "./feature/sfxHandler";
import { reminderBreathWeapon } from "./feature/reminderEffects";
import { toggleSettings } from "./feature/settingsHandler";
import { reduceFrightened } from "./feature/conditionHandler";
import { chatCardCollapse } from "./feature/qolHandler";
import { calcRemainingMinutes, startTimer } from "./feature/heroPointHandler";

export const MODULENAME = "xdy-pf2e-workbench";

// Initialize module
Hooks.once("init", async () => {
    console.log(`${MODULENAME} | Initializing xdy-pf2e-workbench`);

    registerSettings();

    await preloadTemplates();

    //Hooks that always run
    Hooks.on("renderSettingsConfig", (_app: any, html: JQuery) => {
        toggleSettings(html);
    });

    //Hooks that only run if a setting that needs it has been enabled
    if (
        (game.settings.get(MODULENAME, "autoRollDamageForStrike") &&
            (game.settings.get(MODULENAME, "autoRollDamageForStrike") ||
                game.settings.get(MODULENAME, "autoRollDamageForSpellAttack"))) ||
        game.settings.get(MODULENAME, "automatedAnimationOn") ||
        game.settings.get(MODULENAME, "applyPersistentDamage") ||
        game.settings.get(MODULENAME, "reminderBreathWeapon")
    ) {
        Hooks.on("createChatMessage", async (message: ChatMessagePF2e) => {
            if (game.user.isGM && game.settings.get(MODULENAME, "automatedAnimationOn")) {
                await playAnimationAndSound(message);
            }

            if (
                game.settings.get(MODULENAME, "autoRollDamageForStrike") &&
                (game.settings.get(MODULENAME, "autoRollDamageForStrike") ||
                    game.settings.get(MODULENAME, "autoRollDamageForSpellAttack"))
            ) {
                await autoRollDamage(message);
            }

            if (game.settings.get(MODULENAME, "applyPersistentDamage")) {
                await persistentDamage(message);
            }

            if (game.settings.get(MODULENAME, "reminderBreathWeapon")) {
                await reminderBreathWeapon(message);
            }
        });
    }

    if (
        game.settings.get(MODULENAME, "autoCollapseItemChatCardContent") === "collapsedDefault" ||
        game.settings.get(MODULENAME, "autoCollapseItemChatCardContent") === "nonCollapsedDefault" ||
        game.settings.get(MODULENAME, "applyPersistentHealing") ||
        (game.settings.get(MODULENAME, "npcMystifier") &&
            game.settings.get(MODULENAME, "npcMystifierUseMystifiedNameInChat"))
    ) {
        Hooks.on("renderChatMessage", async (message: ChatMessagePF2e, html: JQuery) => {
            if (game.user?.isGM && game.settings.get(MODULENAME, "npcMystifierUseMystifiedNameInChat")) {
                mangleChatMessage(message, html);
            }

            if (game.settings.get(MODULENAME, "applyPersistentHealing")) {
                await persistentHealing(message);
            }

            if (
                game.settings.get(MODULENAME, "autoCollapseItemChatCardContent") === "collapsedDefault" ||
                game.settings.get(MODULENAME, "autoCollapseItemChatCardContent") === "nonCollapsedDefault"
            ) {
                chatCardCollapse(html);
            }
        });
    }

    if (game.settings.get(MODULENAME, "purgeExpiredEffectsOnTimeIncreaseOutOfCombat")) {
        Hooks.on("updateWorldTime", async (_total, diff) => {
            if (
                game.user?.isGM &&
                game.settings.get(MODULENAME, "purgeExpiredEffectsOnTimeIncreaseOutOfCombat") &&
                !game.combat?.active &&
                diff >= 1
            ) {
                game.pf2e.effectTracker.removeExpired();
            }
        });
    }

    if (game.settings.get(MODULENAME, "purgeExpiredEffectsEachTurn")) {
        Hooks.on("updateCombat", (combat: EncounterPF2e) => {
            if (
                game.user?.isGM &&
                game.settings.get(MODULENAME, "purgeExpiredEffectsEachTurn") &&
                combat.combatant &&
                combat.combatant.actor
            ) {
                game.pf2e.effectTracker.removeExpired(combat.combatant.actor);
            }
        });
    }

    if (game.settings.get(MODULENAME, "decreaseFrightenedConditionEachTurn")) {
        Hooks.on("pf2e.endTurn", async (combatant: CombatantPF2e, _combat: EncounterPF2e, _userId: string) => {
            if (game.settings.get(MODULENAME, "decreaseFrightenedConditionEachTurn")) {
                await reduceFrightened(combatant);
            }
        });
    }

    if (game.settings.get(MODULENAME, "npcMystifier")) {
        Hooks.on("renderTokenHUD", (_app: TokenHUD, html: JQuery, data: any) => {
            if (game.user?.isGM && game.settings.get(MODULENAME, "npcMystifier")) {
                renderNameHud(data, html);
            }
        });
    }

    if (game.settings.get(MODULENAME, "enableAutomaticMove") === "deprecatedManually") {
        Hooks.on("getCombatTrackerEntryContext", (html: JQuery, entryOptions: any) => {
            deprecatedMoveManually(entryOptions);
        });
    }

    if (game.settings.get(MODULENAME, "enableAutomaticMove") === "reaching0HP") {
        Hooks.on("preUpdateActor", async (actor: ActorPF2e, update: Record<string, string>) => {
            await moveOnZeroHP(actor, update);
        });
    }

    if (game.settings.get(MODULENAME, "enableAutomaticMove") === "deprecatedGettingStatusDying") {
        Hooks.on("preUpdateToken", async (tokenDoc: TokenDocumentPF2e, update) => {
            await moveOnDying(tokenDoc, update);
        });
    }
    if (game.settings.get(MODULENAME, "npcMystifier")) {
        Hooks.on("createToken", async (token: any) => {
            if (game.user?.isGM && game.settings.get(MODULENAME, "npcMystifier")) {
                tokenCreateMystification(token);
            }
        });
    }

    Hooks.on("renderSettingsConfig", (_app: any, html: JQuery) => {
        const settings: [string, any][] = Array.from(game.settings.settings.entries());
        settings.forEach((setting: [string, any]) => {
            const name = setting[0];
            //TODO Do this in a more elegant way
            //Disable all dependent npcMystifier settings
            if (name !== `${MODULENAME}.npcMystifier` && setting[0].startsWith(`${MODULENAME}.npcMystifier`)) {
                const valueFunction = !game.settings.get(MODULENAME, "npcMystifier");

                html.find(`input[name="${name}"]`).parent().parent().toggle(!valueFunction);
                html.find(`select[name="${name}"]`).parent().parent().toggle(!valueFunction);
            }
            if (
                name !== `${MODULENAME}.automatedAnimationOn` &&
                setting[0].startsWith(`${MODULENAME}.automatedAnimationOn`)
            ) {
                const valueFunction = !game.settings.get(MODULENAME, "automatedAnimationOn");

                html.find(`input[name="${name}"]`).parent().parent().toggle(!valueFunction);
                html.find(`select[name="${name}"]`).parent().parent().toggle(!valueFunction);
            }
        });
    });

    // Register custom sheets (if any)
});

// Setup module
Hooks.once("setup", async () => {
    console.log(`${MODULENAME} | Setting up`);
    // Do anything after initialization but before ready

    registerKeybindings();

    //General module setup
    if (game.settings.get(MODULENAME, "abpVariantAllowItemBonuses")) {
        // @ts-ignore
        game.pf2e.variantRules.AutomaticBonusProgression.suppressRuleElement = function suppressRuleElement(): boolean {
            return false;
        };
    }
});

// When ready
Hooks.once("ready", async () => {
    // Do anything once the module is ready
    console.log(`${MODULENAME} | Ready`);

    // Must be in ready
    if (game.settings.get(MODULENAME, "heroPointHandler")) {
        if (game.user?.isGM) {
            await startTimer(calcRemainingMinutes());
        }
    }

    Hooks.callAll(`${MODULENAME}.moduleReady`);
});
