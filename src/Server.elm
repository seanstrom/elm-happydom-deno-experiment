port module Server exposing (..)

import Browser
import Dict exposing (Dict)
import Html exposing (..)
import Html.Attributes exposing (..)
import Html.Events exposing (..)
import Json.Decode as Decode exposing (Decoder)
import Json.Encode as Encode
import Maybe exposing (withDefault)
import Shared exposing (todoDecoder, todoEncoder)



-- Main


main : Program () Model Msg
main =
    Browser.element
        { init = init
        , update = update
        , subscriptions = subscriptions
        , view = view
        }



-- Platform


type alias Handle =
    Encode.Value


type alias Params =
    Encode.Value


type alias Context =
    Encode.Value


type alias ContextDict =
    Dict String Handle


type alias OutMsg content =
    { content : content
    , context : Context
    }


port outbox : OutMsg Params -> Cmd msg



-- Domains


type alias Query params =
    { entity : String
    , operation : String
    , params : Codec params
    }


type alias Model =
    { sharedContext : ContextDict }



-- Decoders


type alias Encoder a =
    a -> Encode.Value


type alias Codec a =
    { data : a
    , decoder : Decoder a
    , encoder : Encoder a
    }


encode : Encoder a -> a -> Encode.Value
encode encoder data =
    encoder data


decode : a -> Decoder a -> Decode.Value -> a
decode default decoder value =
    Decode.decodeValue decoder value
        |> Result.toMaybe
        |> withDefault default


eventDecoder : Decoder a -> Decoder a
eventDecoder helperDecoder =
    Decode.at [ "detail" ] helperDecoder


handleDecoder : Decoder Handle
handleDecoder =
    Decode.value


payloadDecoder : Decoder a -> Decoder a
payloadDecoder helperDecoder =
    eventDecoder <| Decode.field "payload" helperDecoder


contextDecoder : Decoder a -> Decoder a
contextDecoder helperDecoder =
    eventDecoder <| Decode.field "context" helperDecoder


outMsgEncoder : OutMsg Params -> Encode.Value
outMsgEncoder outMsg =
    Encode.object
        [ ( "context", outMsg.context )
        , ( "params", outMsg.content )
        ]


queryEncoder : Query params -> Params
queryEncoder info =
    Encode.object
        [ ( "entity", Encode.string info.entity )
        , ( "operation", Encode.string info.operation )
        , ( "params", encode info.params.encoder info.params.data )
        , ( "type", Encode.string "query" )
        ]


jsonResponseEncoder : (a -> Encode.Value) -> a -> Params
jsonResponseEncoder helperEncoder params =
    Encode.object
        [ ( "payload", helperEncoder params )
        , ( "type", Encode.string "json-response" )
        ]


htmlResponseEncoder : (a -> Encode.Value) -> a -> Params
htmlResponseEncoder helperEncoder params =
    Encode.object
        [ ( "payload", helperEncoder params )
        , ( "type", Encode.string "html-response" )
        ]



-- Event Attributes


onAppRequest : (Handle -> msg) -> Attribute msg
onAppRequest msg =
    on "app-request" (Decode.map msg (eventDecoder handleDecoder))


onAppInit : (Handle -> msg) -> Attribute msg
onAppInit msg =
    on "app-init" (Decode.map msg (eventDecoder handleDecoder))


onAppDbPayload : (Context -> Decode.Value -> msg) -> Attribute msg
onAppDbPayload msg =
    on "app-db-payload" <|
        Decode.map2 msg
            (contextDecoder Decode.value)
            (payloadDecoder Decode.value)



-- Taaks


query : Context -> Query a -> OutMsg Params
query context params =
    { content = queryEncoder params, context = context }


jsonResponse : Context -> (response -> Encode.Value) -> response -> OutMsg Params
jsonResponse context encoder params =
    { content = jsonResponseEncoder encoder params
    , context = context
    }


htmlResponse : Context -> (response -> Encode.Value) -> response -> OutMsg Params
htmlResponse context encoder params =
    { content = htmlResponseEncoder encoder params
    , context = context
    }



-- Init


init : () -> ( Model, Cmd Msg )
init _ =
    ( { sharedContext = Dict.empty }, Cmd.none )



-- Update


type NewTodoParams
    = NewTodo { name : String }


type Msg
    = ServerRequest Handle
    | DatabaseConnection Handle
    | DatabasePayload Context Handle


update : Msg -> Model -> ( Model, Cmd Msg )
update msg model =
    case msg of
        ServerRequest requestHandle ->
            let
                hasDbHandle =
                    Dict.get "dbHandle" model.sharedContext
                        /= Nothing
            in
            if hasDbHandle then
                let
                    localContext =
                        model.sharedContext
                            |> Dict.insert "requestHandle" requestHandle
                            |> Encode.dict identity identity

                    paramsEncoder : Encoder NewTodoParams
                    paramsEncoder (NewTodo info) =
                        Encode.object
                            [ ( "name", Encode.string info.name ) ]

                    paramsDecoder : Decoder NewTodoParams
                    paramsDecoder =
                        let
                            toInfo name =
                                NewTodo { name = name }
                        in
                        Decode.map toInfo (Decode.field "name" Decode.string)

                    data : NewTodoParams
                    data =
                        NewTodo { name = "New Todo" }

                    paramsCodec : Codec NewTodoParams
                    paramsCodec =
                        { data = data
                        , decoder = paramsDecoder
                        , encoder = paramsEncoder
                        }

                    params : Query NewTodoParams
                    params =
                        { operation = "new"
                        , entity = "todo"
                        , params = paramsCodec
                        }
                in
                ( model, outbox <| query localContext params )

            else
                ( model, Cmd.none )

        DatabaseConnection dbHandle ->
            let
                sharedContext =
                    model.sharedContext |> Dict.insert "dbHandle" dbHandle
            in
            ( { model | sharedContext = sharedContext }, Cmd.none )

        DatabasePayload encodedContext payload ->
            let
                decodedPayload =
                    Decode.decodeValue (Decode.list todoDecoder) payload
                        |> Result.toMaybe
                        |> Maybe.withDefault []

                decodedContext =
                    Decode.decodeValue
                        (Decode.dict handleDecoder)
                        encodedContext
                        |> Result.toMaybe

                mergeContext =
                    \localContext ->
                        let
                            requestHandle =
                                Dict.get "requestHandle" localContext
                        in
                        requestHandle
                            |> Maybe.map
                                (\handle ->
                                    model.sharedContext
                                        |> Dict.insert "requestHandle" handle
                                        |> Encode.dict identity identity
                                )
            in
            decodedContext
                |> Maybe.andThen mergeContext
                |> Maybe.andThen
                    (\localContext ->
                        Just
                            ( model
                            , outbox <|
                                htmlResponse localContext (Encode.list todoEncoder) decodedPayload
                            )
                    )
                |> Maybe.withDefault ( model, Cmd.none )



-- Subscriptions


subscriptions : Model -> Sub Msg
subscriptions _ =
    Sub.none



-- View


view : Model -> Html Msg
view _ =
    app
        [ onAppRequest ServerRequest
        , onAppInit DatabaseConnection
        , onAppDbPayload DatabasePayload
        ]
        []


app : List (Attribute msg) -> List (Html msg) -> Html msg
app attrs children =
    node "x-app" attrs children
